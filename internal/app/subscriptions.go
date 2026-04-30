package app

import (
	"crypto/sha1"
	"encoding/base64"
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
	subClient := &http.Client{Timeout: 60 * time.Second}
	resp, err := subClient.Do(req)
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
	decoded := decodeBase64Content(data)
	if decoded != nil {
		proxies := parseURIProxies(decoded)
		if len(proxies) > 0 {
			proxies = deduplicateProxyNames(proxies)
			for i := range proxies {
				proxies[i]["skip-cert-verify"] = true
			}
			doc := yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{{
				Kind: yaml.MappingNode,
				Content: []*yaml.Node{
					scalar("proxies"), proxiesToYAML(proxies),
				},
			}}}
			return yaml.Marshal(&doc)
		}
	}

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
		deduped := deduplicateYAMLProxies(proxies)
		doc := yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{{
			Kind: yaml.MappingNode,
			Content: []*yaml.Node{
				scalar("proxies"), deduped,
			},
		}}}
		return yaml.Marshal(&doc)
	}
	return data, nil
}

func decodeBase64Content(data []byte) []byte {
	text := strings.TrimSpace(string(data))
	if text == "" {
		return nil
	}
	decoded, err := base64.StdEncoding.DecodeString(text)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(text)
		if err != nil {
			return nil
		}
	}
	content := string(decoded)
	if strings.HasPrefix(content, "vless://") || strings.HasPrefix(content, "vmess://") ||
		strings.HasPrefix(content, "ss://") || strings.HasPrefix(content, "trojan://") ||
		strings.HasPrefix(content, "ssr://") {
		return []byte(content)
	}
	return nil
}

func parseURIProxies(data []byte) []map[string]any {
	lines := strings.Split(string(data), "\n")
	var proxies []map[string]any
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "vless://") {
			proxy := parseVlessURI(line)
			if proxy != nil {
				proxies = append(proxies, proxy)
			}
		} else if strings.HasPrefix(line, "vmess://") {
			proxy := parseVmessURI(line)
			if proxy != nil {
				proxies = append(proxies, proxy)
			}
		} else if strings.HasPrefix(line, "ss://") {
			proxy := parseSSURI(line)
			if proxy != nil {
				proxies = append(proxies, proxy)
			}
		} else if strings.HasPrefix(line, "trojan://") {
			proxy := parseTrojanURI(line)
			if proxy != nil {
				proxies = append(proxies, proxy)
			}
		}
	}
	return proxies
}

func parseVlessURI(uri string) map[string]any {
	parsed, err := url.Parse(uri)
	if err != nil {
		return nil
	}
	params := parsed.Query()

	name := ""
	if frag := parsed.Fragment; frag != "" {
		name, _ = url.QueryUnescape(frag)
	} else if n := params.Get("name"); n != "" {
		name, _ = url.QueryUnescape(n)
	}
	if name == "" {
		name = fmt.Sprintf("vless-%s:%d", parsed.Hostname(), parsed.Port())
	}

	proxy := map[string]any{
		"name":                name,
		"type":                "vless",
		"server":              parsed.Hostname(),
		"port":                parsed.Port(),
		"uuid":                parsed.User.Username(),
		"skip-cert-verify":    true,
	}

	if flow := params.Get("flow"); flow != "" {
		proxy["flow"] = flow
	}

	security := params.Get("security")
	if security == "tls" || security == "reality" {
		proxy["tls"] = true
		if sni := params.Get("sni"); sni != "" {
			proxy["servername"] = sni
		}
		if fp := params.Get("fp"); fp != "" {
			proxy["client-fingerprint"] = fp
		}
	}

	netType := params.Get("type")
	if netType == "ws" {
		path, _ := url.QueryUnescape(params.Get("path"))
		if path == "" {
			path = "/"
		}
		host := params.Get("host")
		if host == "" {
			host = parsed.Hostname()
		}
		proxy["network"] = "ws"
		proxy["ws-opts"] = map[string]any{
			"path":    path,
			"headers": map[string]string{"Host": host},
		}
	} else if netType == "grpc" {
		path := params.Get("path")
		proxy["network"] = "grpc"
		proxy["grpc-opts"] = map[string]any{
			"grpc-service-name": strings.TrimPrefix(path, "/"),
		}
	}

	return proxy
}

func parseVmessURI(uri string) map[string]any {
	encoded := strings.TrimPrefix(uri, "vmess://")
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(encoded)
		if err != nil {
			decoded, err = base64.StdEncoding.DecodeString(encoded + "==")
			if err != nil {
				return nil
			}
		}
	}

	var config map[string]any
	if err := json.Unmarshal(decoded, &config); err != nil {
		return nil
	}

	name, _ := config["ps"].(string)
	if name == "" {
		name = fmt.Sprintf("vmess-%v", config["add"])
	}

	port, _ := config["port"].(float64)
	proxy := map[string]any{
		"name":             name,
		"type":             "vmess",
		"server":           config["add"],
		"port":             int(port),
		"uuid":             config["id"],
		"alterId":          int(config["aid"].(float64)),
		"cipher":           config["scy"],
		"skip-cert-verify": true,
	}

	if config["tls"] == "tls" {
		proxy["tls"] = true
		if sni, ok := config["sni"].(string); ok && sni != "" {
			proxy["servername"] = sni
		}
	}

	net, _ := config["net"].(string)
	if net == "ws" {
		path, _ := config["path"].(string)
		if path == "" {
			path = "/"
		}
		host, _ := config["host"].(string)
		if host == "" {
			host, _ = proxy["server"].(string)
		}
		proxy["network"] = "ws"
		proxy["ws-opts"] = map[string]any{
			"path":    path,
			"headers": map[string]string{"Host": host},
		}
	} else if net == "grpc" {
		path, _ := config["path"].(string)
		proxy["network"] = "grpc"
		proxy["grpc-opts"] = map[string]any{
			"grpc-service-name": path,
		}
	}

	return proxy
}

func parseSSURI(uri string) map[string]any {
	parsed, err := url.Parse(uri)
	if err != nil {
		return nil
	}

	name := ""
	if frag := parsed.Fragment; frag != "" {
		name, _ = url.QueryUnescape(frag)
	}
	if name == "" {
		name = fmt.Sprintf("ss-%s", parsed.Hostname())
	}

	method := "none"
	password := ""
	if user := parsed.User; user != nil {
		method = user.Username()
		password, _ = user.Password()
	}

	return map[string]any{
		"name":             name,
		"type":             "ss",
		"server":           parsed.Hostname(),
		"port":             parsed.Port(),
		"cipher":           method,
		"password":         password,
		"skip-cert-verify": true,
	}
}

func parseTrojanURI(uri string) map[string]any {
	parsed, err := url.Parse(uri)
	if err != nil {
		return nil
	}
	params := parsed.Query()

	name := ""
	if frag := parsed.Fragment; frag != "" {
		name, _ = url.QueryUnescape(frag)
	}
	if name == "" {
		name = fmt.Sprintf("trojan-%s", parsed.Hostname())
	}

	proxy := map[string]any{
		"name":             name,
		"type":             "trojan",
		"server":           parsed.Hostname(),
		"port":             parsed.Port(),
		"password":         parsed.User.Username(),
		"skip-cert-verify": true,
	}

	if sni := params.Get("sni"); sni != "" {
		proxy["sni"] = sni
	}

	return proxy
}

func deduplicateProxyNames(proxies []map[string]any) []map[string]any {
	seen := make(map[string]int)
	result := make([]map[string]any, 0, len(proxies))

	for _, proxy := range proxies {
		name, _ := proxy["name"].(string)
		if name == "" {
			continue
		}

		if count, exists := seen[name]; exists {
			newName := fmt.Sprintf("%s_%d", name, count+1)
			for seen[newName] > 0 {
				count++
				newName = fmt.Sprintf("%s_%d", name, count+1)
			}
			seen[name] = count + 1
			seen[newName] = 1
			newProxy := make(map[string]any)
			for k, v := range proxy {
				newProxy[k] = v
			}
			newProxy["name"] = newName
			result = append(result, newProxy)
		} else {
			seen[name] = 1
			result = append(result, proxy)
		}
	}

	return result
}

func deduplicateYAMLProxies(proxies *yaml.Node) *yaml.Node {
	if proxies == nil || proxies.Kind != yaml.SequenceNode {
		return proxies
	}

	seen := make(map[string]int)
	newContent := make([]*yaml.Node, 0, len(proxies.Content))

	for _, proxy := range proxies.Content {
		if proxy.Kind != yaml.MappingNode {
			newContent = append(newContent, proxy)
			continue
		}

		var name string
		for i := 0; i+1 < len(proxy.Content); i += 2 {
			if proxy.Content[i].Value == "name" {
				name = proxy.Content[i+1].Value
				break
			}
		}

		if name == "" {
			newContent = append(newContent, proxy)
			continue
		}

		if count, exists := seen[name]; exists {
			newName := fmt.Sprintf("%s_%d", name, count+1)
			for seen[newName] > 0 {
				count++
				newName = fmt.Sprintf("%s_%d", name, count+1)
			}
			seen[name] = count + 1
			seen[newName] = 1

			newProxy := &yaml.Node{Kind: yaml.MappingNode}
			for i := 0; i+1 < len(proxy.Content); i += 2 {
				key := &yaml.Node{Kind: yaml.ScalarNode, Value: proxy.Content[i].Value}
				var value *yaml.Node
				if proxy.Content[i].Value == "name" {
					value = &yaml.Node{Kind: yaml.ScalarNode, Value: newName}
				} else if proxy.Content[i].Value == "skip-cert-verify" {
					value = &yaml.Node{Kind: yaml.ScalarNode, Value: "true"}
				} else {
					value = &yaml.Node{Kind: proxy.Content[i+1].Kind, Value: proxy.Content[i+1].Value, Content: proxy.Content[i+1].Content}
				}
				newProxy.Content = append(newProxy.Content, key, value)
			}
			newContent = append(newContent, newProxy)
		} else {
			seen[name] = 1
			newProxy := &yaml.Node{Kind: yaml.MappingNode}
			hasSkip := false
			for i := 0; i+1 < len(proxy.Content); i += 2 {
				key := &yaml.Node{Kind: yaml.ScalarNode, Value: proxy.Content[i].Value}
				var value *yaml.Node
				if proxy.Content[i].Value == "skip-cert-verify" {
					value = &yaml.Node{Kind: yaml.ScalarNode, Value: "true"}
					hasSkip = true
				} else {
					value = &yaml.Node{Kind: proxy.Content[i+1].Kind, Value: proxy.Content[i+1].Value, Content: proxy.Content[i+1].Content}
				}
				newProxy.Content = append(newProxy.Content, key, value)
			}
			if !hasSkip {
				newProxy.Content = append(newProxy.Content,
					&yaml.Node{Kind: yaml.ScalarNode, Value: "skip-cert-verify"},
					&yaml.Node{Kind: yaml.ScalarNode, Value: "true"})
			}
			newContent = append(newContent, newProxy)
		}
	}

	return &yaml.Node{Kind: yaml.SequenceNode, Content: newContent}
}

func proxiesToYAML(proxies []map[string]any) *yaml.Node {
	seq := &yaml.Node{Kind: yaml.SequenceNode}
	for _, proxy := range proxies {
		mapping := &yaml.Node{Kind: yaml.MappingNode}
		keys := []string{"name", "type", "server", "port", "uuid", "password", "cipher", "alterId", "tls", "skip-cert-verify", "servername", "client-fingerprint", "network", "ws-opts", "grpc-opts", "flow", "sni"}
		for _, key := range keys {
			if val, ok := proxy[key]; ok {
				mapping.Content = append(mapping.Content, scalar(key), valueToYAML(val))
			}
		}
		for key, val := range proxy {
			found := false
			for _, k := range keys {
				if k == key {
					found = true
					break
				}
			}
			if !found {
				mapping.Content = append(mapping.Content, scalar(key), valueToYAML(val))
			}
		}
		seq.Content = append(seq.Content, mapping)
	}
	return seq
}

func valueToYAML(val any) *yaml.Node {
	switch v := val.(type) {
	case string:
		return &yaml.Node{Kind: yaml.ScalarNode, Value: v}
	case int:
		return &yaml.Node{Kind: yaml.ScalarNode, Value: fmt.Sprintf("%d", v)}
	case bool:
		return &yaml.Node{Kind: yaml.ScalarNode, Value: fmt.Sprintf("%v", v)}
	case map[string]any:
		mapping := &yaml.Node{Kind: yaml.MappingNode}
		for key, subVal := range v {
			mapping.Content = append(mapping.Content, scalar(key), valueToYAML(subVal))
		}
		return mapping
	case map[string]string:
		mapping := &yaml.Node{Kind: yaml.MappingNode}
		for key, subVal := range v {
			mapping.Content = append(mapping.Content, scalar(key), scalar(subVal))
		}
		return mapping
	default:
		return &yaml.Node{Kind: yaml.ScalarNode, Value: fmt.Sprintf("%v", v)}
	}
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
