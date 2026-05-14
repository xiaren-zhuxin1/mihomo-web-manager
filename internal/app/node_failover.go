package app

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"sync"
	"time"
)

type NodeHealth struct {
	Name         string    `json:"name"`
	Group        string    `json:"group"`
	GroupType    string    `json:"groupType"`
	Alive        bool      `json:"alive"`
	Delay        int       `json:"delay"`
	LastCheck    time.Time `json:"lastCheck"`
	LastAlive    time.Time `json:"lastAlive,omitempty"`
	ConsecFails  int       `json:"consecFails"`
	TotalChecks  int       `json:"totalChecks"`
	TotalFails   int       `json:"totalFails"`
	SkipAuto     bool      `json:"skipAuto"`
	SkipReason   string    `json:"skipReason,omitempty"`
}

type NodeFailoverConfig struct {
	Enabled          bool          `json:"enabled"`
	CheckInterval    time.Duration `json:"checkInterval"`
	MaxConsecFails   int           `json:"maxConsecFails"`
	DelayThreshold   int           `json:"delayThreshold"`
	AutoSwitch       bool          `json:"autoSwitch"`
	TestURL          string        `json:"testURL"`
	TestTimeout      int           `json:"testTimeout"`
	ExcludedGroups   []string      `json:"excludedGroups"`
}

type NodeFailover struct {
	mu     sync.RWMutex
	config NodeFailoverConfig
	health map[string]*NodeHealth
	server *Server
	stopCh chan struct{}
	stopped bool
}

func NewNodeFailover(server *Server) *NodeFailover {
	return &NodeFailover{
		config: NodeFailoverConfig{
			Enabled:        true,
			CheckInterval:  60 * time.Second,
			MaxConsecFails: 3,
			DelayThreshold: 5000,
			AutoSwitch:     true,
			TestURL:        "http://www.gstatic.com/generate_204",
			TestTimeout:    5000,
			ExcludedGroups: []string{"DIRECT", "REJECT", "COMPATIBLE"},
		},
		health: make(map[string]*NodeHealth),
		server: server,
	}
}

func (nf *NodeFailover) Start() {
	if !nf.config.Enabled {
		return
	}
	nf.stopCh = make(chan struct{})
	nf.stopped = false
	go nf.run()
	log.Printf("[NodeFailover] Started - interval: %s, max fails: %d", nf.config.CheckInterval, nf.config.MaxConsecFails)
}

func (nf *NodeFailover) Stop() {
	nf.mu.Lock()
	defer nf.mu.Unlock()
	if nf.stopped {
		return
	}
	nf.stopped = true
	close(nf.stopCh)
}

func (nf *NodeFailover) run() {
	nf.checkAll()
	ticker := time.NewTicker(nf.config.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-nf.stopCh:
			return
		case <-ticker.C:
			nf.checkAll()
		}
	}
}

func (nf *NodeFailover) checkAll() {
	proxies, err := nf.server.mihomo.GetProxies()
	if err != nil {
		log.Printf("[NodeFailover] Failed to get proxies: %v", err)
		return
	}

	type groupInfo struct {
		nodes []string
		gtype string
	}
	groups := make(map[string]groupInfo)
	for name, proxy := range proxies {
		if len(proxy.All) > 0 && !nf.isExcludedGroup(name) {
			groups[name] = groupInfo{nodes: proxy.All, gtype: proxy.Type}
		}
	}

	var wg sync.WaitGroup
	for groupName, info := range groups {
		for _, nodeName := range info.nodes {
			wg.Add(1)
			go func(g, n, gt string) {
				defer wg.Done()
				nf.checkNode(g, n, gt)
			}(groupName, nodeName, info.gtype)
		}
	}
	wg.Wait()

	if nf.config.AutoSwitch {
		nf.autoSwitchFailedGroups(proxies)
	}
}

func (nf *NodeFailover) isExcludedGroup(name string) bool {
	for _, excluded := range nf.config.ExcludedGroups {
		if name == excluded {
			return true
		}
	}
	return false
}

func (nf *NodeFailover) checkNode(group, node, groupType string) {
	delay, err := nf.testNodeDelay(node)
	now := time.Now()

	nf.mu.Lock()
	defer nf.mu.Unlock()

	key := group + "/" + node
	h, exists := nf.health[key]
	if !exists {
		h = &NodeHealth{
			Name:      node,
			Group:     group,
			GroupType: groupType,
		}
		nf.health[key] = h
	}

	h.LastCheck = now
	h.TotalChecks++
	h.Delay = delay

	if err != nil || delay <= 0 {
		h.Alive = false
		h.ConsecFails++
		h.TotalFails++
		log.Printf("[NodeFailover] Node %s in %s: FAIL (consecutive: %d)", node, group, h.ConsecFails)
	} else {
		h.Alive = true
		h.ConsecFails = 0
		h.LastAlive = now
		if h.Delay > nf.config.DelayThreshold {
			log.Printf("[NodeFailover] Node %s in %s: SLOW (%dms > %dms)", node, group, h.Delay, nf.config.DelayThreshold)
		}
	}

	if h.ConsecFails >= nf.config.MaxConsecFails && !h.SkipAuto {
		h.SkipAuto = true
		h.SkipReason = fmt.Sprintf("连续 %d 次检测失败", h.ConsecFails)
		log.Printf("[NodeFailover] Node %s in %s: AUTO-SKIPPED (%s)", node, group, h.SkipReason)
	}
}

func (nf *NodeFailover) testNodeDelay(node string) (int, error) {
	url := fmt.Sprintf("/proxies/%s/delay?timeout=%d&url=%s",
		pathEscape(node),
		nf.config.TestTimeout,
		pathEscape(nf.config.TestURL),
	)
	status, body, err := nf.server.mihomo.Get(url)
	if err != nil {
		return 0, err
	}
	if status != 200 {
		return 0, fmt.Errorf("status %d", status)
	}
	var result struct {
		Delay int `json:"delay"`
	}
	if err := json.Unmarshal([]byte(body), &result); err != nil {
		return 0, err
	}
	return result.Delay, nil
}

func (nf *NodeFailover) autoSwitchFailedGroups(proxies map[string]MihomoProxyEntry) {
	nf.mu.Lock()
	defer nf.mu.Unlock()

	for groupName, proxy := range proxies {
		if len(proxy.All) == 0 || nf.isExcludedGroup(groupName) {
			continue
		}

		switch proxy.Type {
		case "URLTest", "Fallback", "LoadBalance":
			continue
		}

		currentNode := proxy.Now
		if currentNode == "" {
			continue
		}

		key := groupName + "/" + currentNode
		h, exists := nf.health[key]
		if !exists || !h.SkipAuto {
			continue
		}

		bestNode := nf.findBestNode(groupName, proxy.All)
		if bestNode == "" || bestNode == currentNode {
			continue
		}

		if err := nf.server.mihomo.SwitchProxy(groupName, bestNode); err != nil {
			log.Printf("[NodeFailover] Auto-switch %s: %s -> %s FAILED: %v", groupName, currentNode, bestNode, err)
			continue
		}

		log.Printf("[NodeFailover] Auto-switch %s: %s -> %s (current node had %d consecutive fails)",
			groupName, currentNode, bestNode, h.ConsecFails)

		nf.recordEvent(groupName, currentNode, bestNode, h.ConsecFails)
	}
}

func (nf *NodeFailover) findBestNode(group string, nodes []string) string {
	type candidate struct {
		name  string
		delay int
		alive bool
	}

	candidates := make([]candidate, 0, len(nodes))
	for _, node := range nodes {
		key := group + "/" + node
		h, exists := nf.health[key]
		if !exists {
			candidates = append(candidates, candidate{name: node, delay: 0, alive: false})
			continue
		}
		if h.SkipAuto {
			continue
		}
		candidates = append(candidates, candidate{name: node, delay: h.Delay, alive: h.Alive})
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].alive != candidates[j].alive {
			return candidates[i].alive
		}
		if candidates[i].delay == 0 {
			return false
		}
		if candidates[j].delay == 0 {
			return true
		}
		return candidates[i].delay < candidates[j].delay
	})

	for _, c := range candidates {
		if c.alive && c.delay > 0 && c.delay <= nf.config.DelayThreshold {
			return c.name
		}
	}

	for _, c := range candidates {
		if !c.alive && c.delay == 0 {
			delay, err := nf.testNodeDelay(c.name)
			if err == nil && delay > 0 {
				return c.name
			}
		}
	}

	if len(candidates) > 0 {
		return candidates[0].name
	}
	return ""
}

func (nf *NodeFailover) recordEvent(group, from, to string, fails int) {
	log.Printf("[NodeFailover] Event: group=%s from=%s to=%s fails=%d", group, from, to, fails)
}

func (nf *NodeFailover) GetHealth(group string) []*NodeHealth {
	nf.mu.RLock()
	defer nf.mu.RUnlock()

	result := make([]*NodeHealth, 0)
	for _, h := range nf.health {
		if group == "" || h.Group == group {
			result = append(result, h)
		}
	}
	return result
}

func (nf *NodeFailover) GetConfig() NodeFailoverConfig {
	nf.mu.RLock()
	defer nf.mu.RUnlock()
	return nf.config
}

func (nf *NodeFailover) SetConfig(config NodeFailoverConfig) {
	nf.mu.Lock()
	nf.config = config
	nf.mu.Unlock()
}

func (nf *NodeFailover) ResetNode(group, node string) {
	nf.mu.Lock()
	defer nf.mu.Unlock()
	key := group + "/" + node
	if h, exists := nf.health[key]; exists {
		h.SkipAuto = false
		h.SkipReason = ""
		h.ConsecFails = 0
		log.Printf("[NodeFailover] Node %s in %s: RESET (removed from skip list)", node, group)
	}
}

func (nf *NodeFailover) GetStatus() map[string]any {
	nf.mu.RLock()
	defer nf.mu.RUnlock()

	totalNodes := len(nf.health)
	aliveNodes := 0
	skippedNodes := 0
	failedNodes := 0
	for _, h := range nf.health {
		if h.SkipAuto {
			skippedNodes++
		} else if h.Alive {
			aliveNodes++
		} else {
			failedNodes++
		}
	}

	return map[string]any{
		"enabled":       nf.config.Enabled,
		"autoSwitch":    nf.config.AutoSwitch,
		"checkInterval": nf.config.CheckInterval.String(),
		"totalNodes":    totalNodes,
		"aliveNodes":    aliveNodes,
		"failedNodes":   failedNodes,
		"skippedNodes":  skippedNodes,
		"config":        nf.config,
	}
}

func (s *Server) handleNodeFailoverStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.nodeFailover.GetStatus())
}

func (s *Server) handleNodeFailoverConfig(w http.ResponseWriter, r *http.Request) {
	var config NodeFailoverConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	s.nodeFailover.SetConfig(config)
	writeJSON(w, http.StatusOK, map[string]any{"updated": true})
}

func (s *Server) handleNodeHealth(w http.ResponseWriter, r *http.Request) {
	group := r.URL.Query().Get("group")
	health := s.nodeFailover.GetHealth(group)
	writeJSON(w, http.StatusOK, map[string]any{"health": health})
}

func (s *Server) handleNodeResetSkip(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Group string `json:"group"`
		Node  string `json:"node"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	s.nodeFailover.ResetNode(payload.Group, payload.Node)
	writeJSON(w, http.StatusOK, map[string]any{"reset": true})
}

func (s *Server) handleNodeAutoSwitch(w http.ResponseWriter, r *http.Request) {
	group := r.URL.Query().Get("group")
	if group == "" {
		writeError(w, http.StatusBadRequest, "group parameter is required")
		return
	}

	proxies, err := s.mihomo.GetProxies()
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	proxy, exists := proxies[group]
	if !exists || len(proxy.All) == 0 {
		writeError(w, http.StatusNotFound, "proxy group not found: "+group)
		return
	}

	switch proxy.Type {
	case "URLTest", "Fallback", "LoadBalance":
		writeError(w, http.StatusBadRequest, fmt.Sprintf("cannot manually switch auto group type %q (%s)", proxy.Type, group))
		return
	}

	currentNode := proxy.Now
	bestNode := s.nodeFailover.findBestNode(group, proxy.All)
	if bestNode == "" {
		writeError(w, http.StatusNotFound, "no healthy node available")
		return
	}

	if bestNode == currentNode {
		writeJSON(w, http.StatusOK, map[string]any{
			"switched": false,
			"current":  currentNode,
			"message":  "current node is already the best",
		})
		return
	}

	if err := s.mihomo.SwitchProxy(group, bestNode); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"switched": true,
		"from":     currentNode,
		"to":       bestNode,
	})
}

func (s *Server) handleBatchNodeTest(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Group string   `json:"group"`
		Nodes []string `json:"nodes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	type testResult struct {
		Node  string `json:"node"`
		Alive bool   `json:"alive"`
		Delay int    `json:"delay"`
		Error string `json:"error,omitempty"`
	}

	results := make([]testResult, 0, len(payload.Nodes))
	var mu sync.Mutex
	var wg sync.WaitGroup

	nodes := payload.Nodes
	if len(nodes) == 0 && payload.Group != "" {
		proxies, err := s.mihomo.GetProxies()
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		if proxy, ok := proxies[payload.Group]; ok {
			nodes = proxy.All
		}
	}

	for _, node := range nodes {
		wg.Add(1)
		go func(n string) {
			defer wg.Done()
			delay, err := s.nodeFailover.testNodeDelay(n)
			mu.Lock()
			r := testResult{Node: n}
			if err != nil {
				r.Alive = false
				r.Error = err.Error()
			} else {
				r.Alive = true
				r.Delay = delay
			}
			results = append(results, r)
			mu.Unlock()
		}(node)
	}
	wg.Wait()

	sort.Slice(results, func(i, j int) bool {
		if results[i].Alive != results[j].Alive {
			return results[i].Alive
		}
		return results[i].Delay < results[j].Delay
	})

	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}
