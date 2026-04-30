package app

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Subscription struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	URL          string    `json:"url"`
	ProviderName string    `json:"providerName"`
	Enabled      bool      `json:"enabled"`
	Managed      bool      `json:"managed"`
	Type         string    `json:"type,omitempty"`
	Path         string    `json:"path,omitempty"`
	Exists       bool      `json:"exists"`
	UpdatedAt    time.Time `json:"updatedAt,omitempty"`
	Upload       int64     `json:"upload,omitempty"`
	Download     int64     `json:"download,omitempty"`
	Total        int64     `json:"total,omitempty"`
	Expire       int64     `json:"expire,omitempty"`
	Error        string    `json:"error,omitempty"`
	NodeCount    int       `json:"nodeCount,omitempty"`
	LastStatus   string    `json:"lastStatus,omitempty"`
}

func (s *Server) handleListSubscriptions(w http.ResponseWriter, r *http.Request) {
	items, err := s.loadSubscriptions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	items, err = s.mergeConfigProviders(items)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	for index := range items {
		items[index].NodeCount = s.providerNodeCount(items[index])
	}
	writeJSON(w, http.StatusOK, map[string]any{"subscriptions": items})
}

func (s *Server) handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	payload.URL = strings.TrimSpace(payload.URL)
	if payload.URL == "" {
		writeError(w, http.StatusBadRequest, "subscription url is required")
		return
	}
	if _, err := url.ParseRequestURI(payload.URL); err != nil {
		writeError(w, http.StatusBadRequest, "subscription url is invalid")
		return
	}
	items, err := s.loadSubscriptions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	id := subscriptionID(payload.URL)
	for _, item := range items {
		if item.ID == id {
			writeError(w, http.StatusConflict, "subscription already exists")
			return
		}
	}
	name := strings.TrimSpace(payload.Name)
	if name == "" {
		name = guessSubscriptionName(payload.URL)
	}
	item := Subscription{
		ID:           id,
		Name:         name,
		URL:          payload.URL,
		ProviderName: "sub_" + id[:10],
		Enabled:      true,
		Managed:      true,
		Type:         "file",
		Path:         "./proxy-providers/sub_" + id[:10] + ".yaml",
		Exists:       true,
	}
	items = append(items, item)
	if err := s.saveSubscriptions(items); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.writeProviderFile(item, []byte("proxies: []\n")); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.ensureProviderInConfig(item); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_, _, _ = s.reloadMihomo()
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) handleEditSubscription(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var payload struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	payload.Name = strings.TrimSpace(payload.Name)
	payload.URL = strings.TrimSpace(payload.URL)
	if payload.URL == "" {
		writeError(w, http.StatusBadRequest, "subscription url is required")
		return
	}
	if _, err := url.ParseRequestURI(payload.URL); err != nil {
		writeError(w, http.StatusBadRequest, "subscription url is invalid")
		return
	}
	items, err := s.loadSubscriptions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	for index, item := range items {
		if item.ID != id {
			continue
		}
		if !item.Managed {
			writeError(w, http.StatusBadRequest, "only manager subscriptions can be edited")
			return
		}
		item.Name = payload.Name
		if item.Name == "" {
			item.Name = guessSubscriptionName(payload.URL)
		}
		item.URL = payload.URL
		item.Error = ""
		item.LastStatus = "edited"
		items[index] = item
		if err := s.saveSubscriptions(items); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, item)
		return
	}
	writeError(w, http.StatusNotFound, "subscription not found")
}

func (s *Server) handleUpdateSubscription(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	items, err := s.loadSubscriptions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	for index, item := range items {
		if item.ID != id {
			continue
		}
		updated, err := s.refreshSubscription(item)
		if err != nil {
			item.Error = err.Error()
			item.LastStatus = "failed"
			items[index] = item
			_ = s.saveSubscriptions(items)
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		items[index] = updated
		if err := s.saveSubscriptions(items); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, updated)
		return
	}
	if strings.HasPrefix(id, "config_") {
		provider := strings.TrimPrefix(id, "config_")
		configItems, _ := s.mergeConfigProviders([]Subscription{})
		for _, item := range configItems {
			if item.ProviderName == provider && item.Type == "file" && !item.Exists {
				writeError(w, http.StatusBadRequest, "provider file does not exist: "+item.Path)
				return
			}
		}
		status, body, err := s.forwardMihomo("PUT", "/providers/proxies/"+url.PathEscape(provider), strings.NewReader(`{}`))
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		if status >= 300 {
			writeError(w, http.StatusBadGateway, body)
			return
		}
		configItems, _ = s.mergeConfigProviders([]Subscription{})
		for _, item := range configItems {
			if item.ProviderName == provider {
				item.LastStatus = "updated"
				item.UpdatedAt = time.Now()
				writeJSON(w, http.StatusOK, item)
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"updated": true, "providerName": provider})
		return
	}
	writeError(w, http.StatusNotFound, "subscription not found")
}

func (s *Server) handleDeleteSubscription(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	items, err := s.loadSubscriptions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	next := items[:0]
	var removed *Subscription
	for _, item := range items {
		if item.ID == id {
			copy := item
			removed = &copy
			continue
		}
		next = append(next, item)
	}
	if removed == nil {
		if strings.HasPrefix(id, "config_") {
			item := Subscription{
				ID:           id,
				ProviderName: strings.TrimPrefix(id, "config_"),
			}
			if err := s.removeProviderFromConfig(item); err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			if _, _, err := s.reloadMihomo(); err != nil {
				writeJSON(w, http.StatusAccepted, map[string]any{
					"deleted":     true,
					"reloadError": err.Error(),
				})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
			return
		}
		writeError(w, http.StatusNotFound, "subscription not found")
		return
	}
	if err := s.removeProviderFromConfig(*removed); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.saveSubscriptions(next); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_, _, _ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

func (s *Server) refreshSubscription(item Subscription) (Subscription, error) {
	req, err := http.NewRequest(http.MethodGet, item.URL, nil)
	if err != nil {
		return item, err
	}
	req.Header.Set("User-Agent", "Clash Verge/2.0 MihomoWebManager/0.1")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return item, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return item, err
	}
	if resp.StatusCode >= 400 {
		return item, fmt.Errorf("subscription returned %s", resp.Status)
	}
	if strings.TrimSpace(string(data)) == "" {
		return item, fmt.Errorf("subscription returned empty content")
	}
	if err := s.writeProviderFile(item, data); err != nil {
		return item, err
	}
	if err := s.ensureProviderInConfig(item); err != nil {
		return item, err
	}
	if _, _, err := s.reloadMihomo(); err != nil {
		return item, err
	}
	item.Upload, item.Download, item.Total, item.Expire = parseUserInfo(resp.Header.Get("Subscription-Userinfo"))
	item.UpdatedAt = time.Now()
	item.Error = ""
	item.LastStatus = "updated"
	item.Type = "file"
	item.Path = "./proxy-providers/" + item.ProviderName + ".yaml"
	item.Exists = true
	item.NodeCount = countProviderNodes(data)

	status, body, err := s.forwardMihomo("PUT", "/providers/proxies/"+url.PathEscape(item.ProviderName), strings.NewReader(`{}`))
	if err != nil {
		return item, err
	}
	if status >= 300 {
		return item, fmt.Errorf("provider update failed: %s", body)
	}
	return item, nil
}

func (s *Server) loadSubscriptions() ([]Subscription, error) {
	path := s.subscriptionsPath()
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return []Subscription{}, nil
	}
	if err != nil {
		return nil, err
	}
	var items []Subscription
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Server) saveSubscriptions(items []Subscription) error {
	if err := os.MkdirAll(s.cfg.DataDir, 0o750); err != nil {
		return err
	}
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.subscriptionsPath(), data, 0o640)
}

func (s *Server) mergeConfigProviders(items []Subscription) ([]Subscription, error) {
	root, err := s.readConfigYAML()
	if err != nil {
		return items, nil
	}
	providers := mappingValue(root, "proxy-providers")
	if providers == nil || providers.Kind != yaml.MappingNode {
		return items, nil
	}
	seen := map[string]bool{}
	for _, item := range items {
		seen[item.ProviderName] = true
	}
	for i := 0; i+1 < len(providers.Content); i += 2 {
		name := providers.Content[i].Value
		if seen[name] {
			continue
		}
		node := providers.Content[i+1]
		item := Subscription{
			ID:           "config_" + name,
			Name:         name,
			ProviderName: name,
			Enabled:      true,
			Managed:      false,
			Type:         childScalar(node, "type"),
			URL:          childScalar(node, "url"),
			Path:         childScalar(node, "path"),
		}
		item.Exists = s.providerPathExists(item)
		item.NodeCount = s.providerNodeCount(item)
		items = append(items, item)
	}
	return items, nil
}

func (s *Server) providerNodeCount(item Subscription) int {
	if item.Type == "file" && item.Path != "" {
		path := item.Path
		if !filepath.IsAbs(path) {
			path = filepath.Join(filepath.Dir(s.cfg.MihomoConfigPath), path)
		}
		data, err := os.ReadFile(filepath.Clean(path))
		if err == nil {
			return countProviderNodes(data)
		}
	}
	if item.ProviderName != "" {
		status, body, err := s.forwardMihomo("GET", "/providers/proxies/"+url.PathEscape(item.ProviderName), nil)
		if err == nil && status == 200 {
			var result struct {
				Proxies []any `json:"proxies"`
			}
			if json.Unmarshal([]byte(body), &result) == nil {
				return len(result.Proxies)
			}
		}
	}
	return item.NodeCount
}

func (s *Server) providerPathExists(item Subscription) bool {
	if item.Type != "file" || item.Path == "" {
		return true
	}
	path := item.Path
	if !filepath.IsAbs(path) {
		path = filepath.Join(filepath.Dir(s.cfg.MihomoConfigPath), path)
	}
	_, err := os.Stat(filepath.Clean(path))
	return err == nil
}

func (s *Server) subscriptionsPath() string {
	return filepath.Join(s.cfg.DataDir, "subscriptions.json")
}

func (s *Server) ensureProviderInConfig(item Subscription) error {
	root, err := s.readConfigYAML()
	if err != nil {
		return err
	}
	providers := ensureMapping(root, "proxy-providers")
	setProvider(providers, item)
	return s.writeConfigYAML(root)
}

func (s *Server) removeProviderFromConfig(item Subscription) error {
	root, err := s.readConfigYAML()
	if err != nil {
		return err
	}
	providers := mappingValue(root, "proxy-providers")
	if providers != nil && providers.Kind == yaml.MappingNode {
		removeMappingKey(providers, item.ProviderName)
	}
	return s.writeConfigYAML(root)
}

func (s *Server) readConfigYAML() (*yaml.Node, error) {
	data, err := os.ReadFile(s.cfg.MihomoConfigPath)
	if err != nil {
		return nil, err
	}
	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	if len(doc.Content) == 0 {
		doc.Kind = yaml.DocumentNode
		doc.Content = []*yaml.Node{{Kind: yaml.MappingNode}}
	}
	return doc.Content[0], nil
}

func (s *Server) writeConfigYAML(root *yaml.Node) error {
	if _, err := s.backupConfig(); err != nil && !os.IsNotExist(err) {
		return err
	}
	doc := yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{root}}
	data, err := yaml.Marshal(&doc)
	if err != nil {
		return err
	}
	return os.WriteFile(s.cfg.MihomoConfigPath, data, 0o640)
}

func (s *Server) reloadMihomo() (int, string, error) {
	status, body, err := s.forwardMihomo("PUT", "/configs?force=true", strings.NewReader(`{}`))
	if err != nil {
		return status, body, err
	}
	if status >= 300 {
		return status, body, fmt.Errorf("mihomo reload failed: %s", body)
	}
	return status, body, nil
}

func ensureMapping(root *yaml.Node, key string) *yaml.Node {
	if root.Kind != yaml.MappingNode {
		root.Kind = yaml.MappingNode
		root.Content = nil
	}
	if node := mappingValue(root, key); node != nil {
		if node.Kind != yaml.MappingNode {
			node.Kind = yaml.MappingNode
			node.Content = nil
		}
		return node
	}
	value := &yaml.Node{Kind: yaml.MappingNode}
	root.Content = append(root.Content, scalar(key), value)
	return value
}

func mappingValue(root *yaml.Node, key string) *yaml.Node {
	for i := 0; i+1 < len(root.Content); i += 2 {
		if root.Content[i].Value == key {
			return root.Content[i+1]
		}
	}
	return nil
}

func setProvider(providers *yaml.Node, item Subscription) {
	removeMappingKey(providers, item.ProviderName)
	providers.Content = append(providers.Content, scalar(item.ProviderName), &yaml.Node{
		Kind: yaml.MappingNode,
		Content: []*yaml.Node{
			scalar("type"), scalar("file"),
			scalar("path"), scalar("./proxy-providers/" + item.ProviderName + ".yaml"),
			scalar("health-check"), {
				Kind: yaml.MappingNode,
				Content: []*yaml.Node{
					scalar("enable"), scalar("true"),
					scalar("url"), scalar("https://www.gstatic.com/generate_204"),
					scalar("interval"), scalar("300"),
					scalar("lazy"), scalar("true"),
				},
			},
		},
	})
}

func removeMappingKey(root *yaml.Node, key string) {
	next := root.Content[:0]
	for i := 0; i+1 < len(root.Content); i += 2 {
		if root.Content[i].Value == key {
			continue
		}
		next = append(next, root.Content[i], root.Content[i+1])
	}
	root.Content = next
}

func scalar(value string) *yaml.Node {
	return &yaml.Node{Kind: yaml.ScalarNode, Value: value}
}

func childScalar(root *yaml.Node, key string) string {
	if root == nil || root.Kind != yaml.MappingNode {
		return ""
	}
	for i := 0; i+1 < len(root.Content); i += 2 {
		if root.Content[i].Value == key {
			return root.Content[i+1].Value
		}
	}
	return ""
}

func (s *Server) writeProviderFile(item Subscription, data []byte) error {
	providerData, err := normalizeProviderContent(data)
	if err != nil {
		return err
	}
	dir := filepath.Join(filepath.Dir(s.cfg.MihomoConfigPath), "proxy-providers")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	path := filepath.Join(dir, item.ProviderName+".yaml")
	return os.WriteFile(path, providerData, 0o640)
}

func normalizeProviderContent(data []byte) ([]byte, error) {
	var root yaml.Node
	if err := yaml.Unmarshal(data, &root); err != nil {
		return nil, fmt.Errorf("subscription is not valid yaml: %w", err)
	}
	if len(root.Content) == 0 {
		return nil, fmt.Errorf("subscription yaml is empty")
	}
	body := root.Content[0]
	if body.Kind != yaml.MappingNode {
		return nil, fmt.Errorf("subscription yaml must be a mapping")
	}
	if proxies := mappingValue(body, "proxies"); proxies != nil {
		doc := yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{{
			Kind: yaml.MappingNode,
			Content: []*yaml.Node{
				scalar("proxies"), proxies,
			},
		}}}
		return yaml.Marshal(&doc)
	}
	return data, nil
}

func countProviderNodes(data []byte) int {
	var root yaml.Node
	if err := yaml.Unmarshal(data, &root); err != nil || len(root.Content) == 0 {
		return 0
	}
	proxies := mappingValue(root.Content[0], "proxies")
	if proxies == nil || proxies.Kind != yaml.SequenceNode {
		return 0
	}
	return len(proxies.Content)
}

func subscriptionID(rawURL string) string {
	sum := sha1.Sum([]byte(rawURL))
	return hex.EncodeToString(sum[:])
}

func guessSubscriptionName(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Host == "" {
		return "Subscription"
	}
	return parsed.Host
}

func parseUserInfo(value string) (upload int64, download int64, total int64, expire int64) {
	pairs := strings.Split(value, ";")
	re := regexp.MustCompile(`(?i)^\s*(upload|download|total|expire)\s*=\s*([0-9]+)\s*$`)
	for _, pair := range pairs {
		match := re.FindStringSubmatch(pair)
		if len(match) != 3 {
			continue
		}
		number, _ := strconv.ParseInt(match[2], 10, 64)
		switch strings.ToLower(match[1]) {
		case "upload":
			upload = number
		case "download":
			download = number
		case "total":
			total = number
		case "expire":
			expire = number
		}
	}
	return upload, download, total, expire
}
