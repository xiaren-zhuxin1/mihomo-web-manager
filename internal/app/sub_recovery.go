package app

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

type SubUpdateResult struct {
	SubscriptionID string    `json:"subscriptionId"`
	Success        bool      `json:"success"`
	Error          string    `json:"error,omitempty"`
	Retries        int       `json:"retries"`
	Duration       string    `json:"duration"`
	NodesBefore    int       `json:"nodesBefore"`
	NodesAfter     int       `json:"nodesAfter"`
	Timestamp      time.Time `json:"timestamp"`
}

type SubRecoveryState struct {
	mu             sync.RWMutex
	updateResults  map[string]*SubUpdateResult
	autoUpdate     bool
	updateInterval time.Duration
	lastAutoUpdate time.Time
	stopCh         chan struct{}
	stopped        bool
	server         *Server
}

func NewSubRecoveryState(server *Server) *SubRecoveryState {
	return &SubRecoveryState{
		updateResults:  make(map[string]*SubUpdateResult),
		autoUpdate:     false,
		updateInterval: 4 * time.Hour,
		server:         server,
	}
}

func (sr *SubRecoveryState) StartAutoUpdate() {
	if !sr.autoUpdate {
		return
	}
	sr.stopCh = make(chan struct{})
	sr.stopped = false
	go sr.autoUpdateLoop()
	log.Printf("[SubRecovery] Auto-update started - interval: %s", sr.updateInterval)
}

func (sr *SubRecoveryState) StopAutoUpdate() {
	sr.mu.Lock()
	defer sr.mu.Unlock()
	if sr.stopped {
		return
	}
	sr.stopped = true
	close(sr.stopCh)
}

func (sr *SubRecoveryState) SetAutoUpdate(enabled bool, interval time.Duration) {
	sr.mu.Lock()
	wasRunning := sr.autoUpdate && !sr.stopped
	sr.autoUpdate = enabled
	if interval > 0 {
		sr.updateInterval = interval
	}
	sr.mu.Unlock()

	if enabled && !wasRunning {
		sr.stopCh = make(chan struct{})
		sr.stopped = false
		go sr.autoUpdateLoop()
	} else if !enabled && wasRunning {
		sr.StopAutoUpdate()
	}
}

func (sr *SubRecoveryState) autoUpdateLoop() {
	sr.doAutoUpdate()
	for {
		sr.mu.RLock()
		interval := sr.updateInterval
		sr.mu.RUnlock()

		timer := time.NewTimer(interval)
		select {
		case <-sr.stopCh:
			timer.Stop()
			return
		case <-timer.C:
			sr.doAutoUpdate()
		}
	}
}

func (sr *SubRecoveryState) doAutoUpdate() {
	sr.mu.Lock()
	sr.lastAutoUpdate = time.Now()
	sr.mu.Unlock()

	items, err := sr.server.loadSubscriptions()
	if err != nil {
		log.Printf("[SubRecovery] Failed to load subscriptions: %v", err)
		return
	}

	for _, item := range items {
		if !item.Enabled || !item.Managed {
			continue
		}
		result := sr.server.refreshSubscriptionWithRetry(item, 3)
		sr.mu.Lock()
		sr.updateResults[item.ID] = result
		sr.mu.Unlock()
	}

	log.Printf("[SubRecovery] Auto-update completed for %d subscriptions", len(items))
}

func (s *Server) refreshSubscriptionWithRetry(item Subscription, maxRetries int) *SubUpdateResult {
	start := time.Now()
	result := &SubUpdateResult{
		SubscriptionID: item.ID,
		NodesBefore:    item.NodeCount,
		Timestamp:      time.Now(),
	}

	backupData, backupErr := s.readProviderFile(item)
	if backupErr != nil {
		log.Printf("[SubRecovery] Warning: no backup for %s: %v", item.Name, backupErr)
	}

	for attempt := 1; attempt <= maxRetries; attempt++ {
		result.Retries = attempt - 1
		updated, err := s.refreshSubscription(item)
		if err == nil {
			result.Success = true
			result.NodesAfter = updated.NodeCount
			result.Duration = time.Since(start).Round(time.Millisecond).String()
			return result
		}

		log.Printf("[SubRecovery] Attempt %d/%d failed for %s: %v", attempt, maxRetries, item.Name, err)

		if attempt < maxRetries {
			backoff := time.Duration(attempt) * 5 * time.Second
			time.Sleep(backoff)
		}
	}

	if backupErr == nil && backupData != nil {
		log.Printf("[SubRecovery] Restoring backup for %s", item.Name)
		if err := s.writeProviderFile(item, backupData); err != nil {
			result.Error = fmt.Sprintf("update failed after %d retries, backup restore also failed: %v", maxRetries, err)
		} else {
			result.Error = fmt.Sprintf("update failed after %d retries, backup restored", maxRetries)
			result.NodesAfter = countProviderNodes(backupData)
		}
	} else {
		result.Error = fmt.Sprintf("update failed after %d retries: no backup available", maxRetries)
	}

	result.Duration = time.Since(start).Round(time.Millisecond).String()
	return result
}

func (s *Server) readProviderFile(item Subscription) ([]byte, error) {
	if item.Type != "file" || item.Path == "" {
		return nil, fmt.Errorf("not a file provider")
	}
	path := item.Path
	if !filepath.IsAbs(path) {
		path = filepath.Join(filepath.Dir(s.cfg.MihomoConfigPath), path)
	}
	return os.ReadFile(filepath.Clean(path))
}

func (s *Server) checkSubscriptionConnectivity(rawURL string) *ConnectivityCheck {
	check := &ConnectivityCheck{URL: rawURL, Timestamp: time.Now()}

	start := time.Now()
	data, resp, err := s.fetchSubscription(rawURL)
	check.Latency = time.Since(start).Round(time.Millisecond).String()

	if err != nil {
		check.Reachable = false
		check.Error = err.Error()
		return check
	}
	defer resp.Body.Close()

	check.Reachable = true
	check.StatusCode = resp.StatusCode
	check.ContentLength = len(data)

	if strings := resp.Header.Values("Subscription-Userinfo"); len(strings) > 0 {
		check.UserInfo = strings[0]
	}

	if check.ContentLength == 0 {
		check.Warnings = append(check.Warnings, "订阅返回空内容")
	}

	var yamlCheck struct{}
	if err := yamlUnmarshalStrict(data, &yamlCheck); err != nil {
		check.Warnings = append(check.Warnings, "内容不是有效的YAML: "+err.Error())
	}

	return check
}

func yamlUnmarshalStrict(data []byte, v any) error {
	return yaml.Unmarshal(data, v)
}

type ConnectivityCheck struct {
	URL           string   `json:"url"`
	Reachable     bool     `json:"reachable"`
	Latency       string   `json:"latency"`
	StatusCode    int      `json:"statusCode,omitempty"`
	ContentLength int      `json:"contentLength,omitempty"`
	Error         string   `json:"error,omitempty"`
	Warnings      []string `json:"warnings,omitempty"`
	UserInfo      string   `json:"userInfo,omitempty"`
	Timestamp     time.Time `json:"timestamp"`
}

func (sr *SubRecoveryState) GetUpdateResults() map[string]*SubUpdateResult {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	results := make(map[string]*SubUpdateResult, len(sr.updateResults))
	for k, v := range sr.updateResults {
		results[k] = v
	}
	return results
}

func (sr *SubRecoveryState) GetStatus() map[string]any {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	return map[string]any{
		"autoUpdate":     sr.autoUpdate,
		"updateInterval": sr.updateInterval.String(),
		"lastAutoUpdate": sr.lastAutoUpdate,
		"updateResults":  sr.updateResults,
	}
}

func (s *Server) handleSubscriptionConnectivity(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if payload.URL == "" {
		writeError(w, http.StatusBadRequest, "url is required")
		return
	}
	result := s.checkSubscriptionConnectivity(payload.URL)
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleSubscriptionRetryUpdate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	items, err := s.loadSubscriptions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var found *Subscription
	for _, item := range items {
		if item.ID == id {
			copy := item
			found = &copy
			break
		}
	}
	if found == nil {
		writeError(w, http.StatusNotFound, "subscription not found")
		return
	}
	if !found.Managed {
		writeError(w, http.StatusBadRequest, "only managed subscriptions can be retried")
		return
	}

	result := s.refreshSubscriptionWithRetry(*found, 3)
	s.subRecovery.mu.Lock()
	s.subRecovery.updateResults[id] = result
	s.subRecovery.mu.Unlock()

	if !result.Success {
		writeJSON(w, http.StatusBadGateway, result)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleSubRecoveryStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.subRecovery.GetStatus())
}

func (s *Server) handleSubRecoveryConfig(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		AutoUpdate     bool   `json:"autoUpdate"`
		UpdateInterval string `json:"updateInterval"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	interval := 4 * time.Hour
	if payload.UpdateInterval != "" {
		if d, err := time.ParseDuration(payload.UpdateInterval); err == nil {
			interval = d
		}
	}
	s.subRecovery.SetAutoUpdate(payload.AutoUpdate, interval)
	writeJSON(w, http.StatusOK, map[string]any{
		"autoUpdate":     payload.AutoUpdate,
		"updateInterval": interval.String(),
	})
}
