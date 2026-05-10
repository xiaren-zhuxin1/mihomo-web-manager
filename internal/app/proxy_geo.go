package app

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

const geoCacheDuration = 24 * time.Hour

type GeoInfo struct {
	Country string `json:"country"`
	Region  string `json:"region"`
	City    string `json:"city"`
	ISP     string `json:"org"`
	IP      string `json:"ip"`
	Source  string `json:"source,omitempty"`
}

type geoProvider struct {
	name    string
	url     string
	parse   func([]byte) (*GeoInfo, error)
	timeout time.Duration
}

var geoProviders = []geoProvider{
	{
		name:    "ipinfo.io",
		url:     "https://ipinfo.io/json",
		timeout: 15 * time.Second,
		parse: func(data []byte) (*GeoInfo, error) {
			var result struct {
				Country string `json:"country"`
				Region  string `json:"region"`
				City    string `json:"city"`
				ISP     string `json:"org"`
				IP      string `json:"ip"`
			}
			if err := json.Unmarshal(data, &result); err != nil {
				return nil, err
			}
			return &GeoInfo{
				Country: result.Country,
				Region:  result.Region,
				City:    result.City,
				ISP:     result.ISP,
				IP:      result.IP,
			}, nil
		},
	},
	{
		name:    "ip-api.com",
		url:     "http://ip-api.com/json/?fields=status,country,regionName,city,isp,query",
		timeout: 10 * time.Second,
		parse: func(data []byte) (*GeoInfo, error) {
			var result struct {
				Status   string `json:"status"`
				Country  string `json:"country"`
				Region   string `json:"regionName"`
				City     string `json:"city"`
				ISP      string `json:"isp"`
				IP       string `json:"query"`
			}
			if err := json.Unmarshal(data, &result); err != nil {
				return nil, err
			}
			if result.Status != "success" {
				return nil, fmt.Errorf("ip-api returned status: %s", result.Status)
			}
			return &GeoInfo{
				Country: result.Country,
				Region:  result.Region,
				City:    result.City,
				ISP:     result.ISP,
				IP:      result.IP,
			}, nil
		},
	},
	{
		name:    "ip.sb",
		url:     "https://api.ip.sb/geoip",
		timeout: 15 * time.Second,
		parse: func(data []byte) (*GeoInfo, error) {
			var result struct {
				Country string `json:"country"`
				Region  string `json:"region"`
				City    string `json:"city"`
				ISP     string `json:"isp"`
				IP      string `json:"ip"`
			}
			if err := json.Unmarshal(data, &result); err != nil {
				return nil, err
			}
			return &GeoInfo{
				Country: result.Country,
				Region:  result.Region,
				City:    result.City,
				ISP:     result.ISP,
				IP:      result.IP,
			}, nil
		},
	},
	{
		name:    "ipapi.co",
		url:     "https://ipapi.co/json/",
		timeout: 15 * time.Second,
		parse: func(data []byte) (*GeoInfo, error) {
			var result struct {
				Country string `json:"country_name"`
				Region  string `json:"region"`
				City    string `json:"city"`
				ISP     string `json:"org"`
				IP      string `json:"ip"`
			}
			if err := json.Unmarshal(data, &result); err != nil {
				return nil, err
			}
			return &GeoInfo{
				Country: result.Country,
				Region:  result.Region,
				City:    result.City,
				ISP:     result.ISP,
				IP:      result.IP,
			}, nil
		},
	},
}

func (s *Server) handleProxyGeo(w http.ResponseWriter, r *http.Request) {
	proxyName := r.PathValue("name")
	if proxyName == "" {
		writeError(w, http.StatusBadRequest, "proxy name is required")
		return
	}

	if cached, ok := s.geoCache.Load("name:" + proxyName); ok {
		if entry, ok := cached.(*geoCacheEntry); ok && time.Now().Before(entry.expiresAt) {
			writeJSON(w, http.StatusOK, entry.info)
			return
		}
	}

	proxyPort, err := s.getMihomoProxyPort()
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get proxy port: %v", err))
		return
	}

	geoInfo, err := s.getProxyGeoInfo(proxyName, proxyPort)
	if err != nil {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("failed to get geo info: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, geoInfo)
}

func (s *Server) handleGeoCache(w http.ResponseWriter, r *http.Request) {
	result := make(map[string]*GeoInfo)
	s.geoCache.Range(func(key, value any) bool {
		keyStr, ok := key.(string)
		if !ok {
			return true
		}
		if !strings.HasPrefix(keyStr, "name:") {
			return true
		}
		if entry, ok := value.(*geoCacheEntry); ok && time.Now().Before(entry.expiresAt) {
			name := strings.TrimPrefix(keyStr, "name:")
			result[name] = entry.info
		}
		return true
	})
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleAutoAssignGroups(w http.ResponseWriter, r *http.Request) {
	byCountry := make(map[string][]string)
	s.geoCache.Range(func(key, value any) bool {
		keyStr, ok := key.(string)
		if !ok || !strings.HasPrefix(keyStr, "name:") {
			return true
		}
		entry, ok := value.(*geoCacheEntry)
		if !ok || time.Now().After(entry.expiresAt) {
			return true
		}
		name := strings.TrimPrefix(keyStr, "name:")
		country := entry.info.Country
		if country != "" {
			byCountry[country] = append(byCountry[country], name)
		}
		return true
	})

	if len(byCountry) == 0 {
		writeError(w, http.StatusBadRequest, "no geo cache data available, please test nodes first")
		return
	}

	countryToGroup := map[string]string{
		"JP":         "AUTO-JP",
		"HK":         "AUTO-HK",
		"SG":         "AUTO-SG",
		"US":         "AUTO-US",
	}

	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to read config: %v", err))
		return
	}

	proxyGroups := mappingValue(root, "proxy-groups")
	if proxyGroups == nil || proxyGroups.Kind != yaml.SequenceNode {
		writeError(w, http.StatusInternalServerError, "invalid config: no proxy-groups found")
		return
	}

	modified := false
	groupUpdates := make(map[string][]string)

	for country, groupNames := range byCountry {
		groupName, exists := countryToGroup[country]
		if !exists {
			continue
		}

		for _, groupNode := range proxyGroups.Content {
			nodeName := childScalar(groupNode, "name")
			if nodeName != groupName {
				continue
			}

			hasFilterField := false

			for j, content := range groupNode.Content {
				if content.Kind == yaml.ScalarNode && content.Value == "filter" && j+1 < len(groupNode.Content) {
					filterVal := groupNode.Content[j+1].Value
					newFilter := fmt.Sprintf("^(%s)$", strings.Join(groupNames, "|"))
					if filterVal != newFilter {
						groupNode.Content[j+1].Value = newFilter
						groupNode.Content[j+1].HeadComment = ""
						modified = true
					}
					hasFilterField = true
					break
				}
			}

			if !hasFilterField {
				newFilter := fmt.Sprintf("^(%s)$", strings.Join(groupNames, "|"))
				filterKey := &yaml.Node{Kind: yaml.ScalarNode, Value: "filter"}
				filterVal := &yaml.Node{Kind: yaml.ScalarNode, Value: newFilter}
				groupNode.Content = append(groupNode.Content, filterKey, filterVal)
				modified = true
			}

			groupUpdates[groupName] = groupNames
			break
		}
	}

	if !modified {
		writeJSON(w, http.StatusOK, map[string]any{
			"modified": false,
			"message":  "groups already configured correctly or no matching countries found",
			"updates":  groupUpdates,
		})
		return
	}

	configPath := s.cfg.MihomoConfigPath
	out, err := yaml.Marshal(root)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to marshal config: %v", err))
		return
	}

	if err := os.WriteFile(configPath, out, 0644); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to write config: %v", err))
		return
	}

	reloadStatus, _, err := s.forwardMihomo("PUT", "/configs?force=true", strings.NewReader(`{}`))
	if err != nil || reloadStatus != 204 {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("config saved but mihomo reload failed (status %d): %v", reloadStatus, err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"modified": true,
		"message":  "strategy groups updated based on geo data",
		"updates":  groupUpdates,
		"reload":   "success",
	})
}

func (s *Server) getMihomoProxyPort() (int, error) {
	root, err := s.readConfigYAML()
	if err != nil {
		return 0, err
	}

	if port := childScalar(root, "mixed-port"); port != "" {
		var p int
		fmt.Sscanf(port, "%d", &p)
		if p > 0 {
			return p, nil
		}
	}

	if port := childScalar(root, "port"); port != "" {
		var p int
		fmt.Sscanf(port, "%d", &p)
		if p > 0 {
			return p, nil
		}
	}

	if port := childScalar(root, "socks-port"); port != "" {
		var p int
		fmt.Sscanf(port, "%d", &p)
		if p > 0 {
			return p, nil
		}
	}

	return 7890, nil
}

type mihomoProxiesResponse struct {
	Proxies map[string]mihomoProxyEntry `json:"proxies"`
}

type mihomoProxyEntry struct {
	Name string   `json:"name"`
	Type string   `json:"type"`
	Now  string   `json:"now"`
	All  []string `json:"all"`
}

func (s *Server) findGroupContainingProxy(proxyName string) (groupName string, currentNow string, err error) {
	status, body, err := s.forwardMihomo("GET", "/proxies", nil)
	if err != nil {
		return "", "", fmt.Errorf("failed to list proxies: %w", err)
	}
	if status != 200 {
		return "", "", fmt.Errorf("list proxies returned status %d", status)
	}

	var resp mihomoProxiesResponse
	if err := json.Unmarshal([]byte(body), &resp); err != nil {
		return "", "", fmt.Errorf("failed to parse proxies: %w", err)
	}

	priorityTypes := map[string]int{"Selector": 0, "Compatible": 1, "URLTest": 2, "Fallback": 3, "LoadBalance": 4}
	bestGroup := ""
	bestPriority := 999
	bestNow := ""

	for name, entry := range resp.Proxies {
		if len(entry.All) == 0 {
			continue
		}
		found := false
		for _, member := range entry.All {
			if member == proxyName {
				found = true
				break
			}
		}
		if !found {
			continue
		}
		p, ok := priorityTypes[entry.Type]
		if !ok {
			p = 99
		}
		if p < bestPriority {
			bestPriority = p
			bestGroup = name
			bestNow = entry.Now
		}
	}

	if bestGroup == "" {
		return "", "", fmt.Errorf("no selectable group contains proxy %q", proxyName)
	}

	return bestGroup, bestNow, nil
}

func (s *Server) getProxyGeoInfo(proxyName string, proxyPort int) (*GeoInfo, error) {
	groupName, originalNow, err := s.findGroupContainingProxy(proxyName)
	if err != nil {
		return nil, fmt.Errorf("failed to find group for proxy: %w", err)
	}

	if err := s.switchProxy(groupName, proxyName); err != nil {
		return nil, fmt.Errorf("failed to switch proxy in group %q: %w", groupName, err)
	}

	defer func() {
		if originalNow != "" {
			s.switchProxy(groupName, originalNow)
		}
	}()

	time.Sleep(150 * time.Millisecond)

	proxyURL := fmt.Sprintf("http://127.0.0.1:%d", proxyPort)
	proxy, err := url.Parse(proxyURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse proxy URL: %w", err)
	}

	var lastErr error
	for _, provider := range geoProviders {
		client := &http.Client{
			Transport: &http.Transport{
				Proxy:           http.ProxyURL(proxy),
				TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
			},
			Timeout: provider.timeout,
		}

		req, err := http.NewRequest("GET", provider.url, nil)
		if err != nil {
			lastErr = fmt.Errorf("[%s] failed to create request: %w", provider.name, err)
			continue
		}
		req.Header.Set("User-Agent", "curl/7.68.0")

		resp, err := client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("[%s] request failed: %w", provider.name, err)
			continue
		}

		data, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("[%s] failed to read response: %w", provider.name, err)
			continue
		}

		geoInfo, err := provider.parse(data)
		if err != nil {
			lastErr = fmt.Errorf("[%s] parse failed: %w", provider.name, err)
			continue
		}

		if geoInfo.Country == "" {
			lastErr = fmt.Errorf("[%s] empty country", provider.name)
			continue
		}

		geoInfo.Source = provider.name

		if geoInfo.IP != "" {
			cacheKey := "ip:" + geoInfo.IP
			s.geoCache.Store(cacheKey, &geoCacheEntry{
				info:      geoInfo,
				expiresAt: time.Now().Add(geoCacheDuration),
			})
		}

		s.geoCache.Store("name:"+proxyName, &geoCacheEntry{
			info:      geoInfo,
			expiresAt: time.Now().Add(geoCacheDuration),
		})
		go s.saveGeoCache()

		return geoInfo, nil
	}

	return nil, fmt.Errorf("all geo providers failed, last error: %w", lastErr)
}

func (s *Server) getCurrentProxy(groupName string) (string, error) {
	status, body, err := s.forwardMihomo("GET", "/proxies/"+url.PathEscape(groupName), nil)
	if err != nil {
		return "", err
	}
	if status != 200 {
		return "", fmt.Errorf("status %d", status)
	}
	var result struct {
		Now string `json:"now"`
	}
	if err := json.Unmarshal([]byte(body), &result); err != nil {
		return "", err
	}
	return result.Now, nil
}

func (s *Server) switchProxy(groupName, proxyName string) error {
	body := fmt.Sprintf(`{"name":"%s"}`, proxyName)
	status, respBody, err := s.forwardMihomo("PUT", "/proxies/"+url.PathEscape(groupName), strings.NewReader(body))
	if err != nil {
		return err
	}
	if status != 204 && status != 200 {
		return fmt.Errorf("status %d, body: %s", status, respBody[:min(len(respBody), 200)])
	}
	return nil
}

type ProxyGeoResult struct {
	Name    string   `json:"name"`
	Country string   `json:"country"`
	Region  string   `json:"region"`
	City    string   `json:"city"`
	IP      string   `json:"ip"`
	Source  string   `json:"source"`
	Error   string   `json:"error,omitempty"`
}

type BatchGeoResult struct {
	Results   []ProxyGeoResult `json:"results"`
	ByCountry map[string]int   `json:"byCountry"`
	Total     int              `json:"total"`
	Success   int              `json:"success"`
	Failed    int              `json:"failed"`
}

func (s *Server) handleBatchProxyGeo(w http.ResponseWriter, r *http.Request) {
	proxyPort, err := s.getMihomoProxyPort()
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get proxy port: %v", err))
		return
	}

	status, body, err := s.forwardMihomo("GET", "/providers/proxies", nil)
	if err != nil {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("failed to get providers: %v", err))
		return
	}
	if status != 200 {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("providers returned status %d", status))
		return
	}

	var providersResp struct {
		Providers map[string]struct {
			Proxies []struct {
				Name string `json:"name"`
			} `json:"proxies"`
		} `json:"providers"`
	}
	if err := json.Unmarshal([]byte(body), &providersResp); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to parse providers: %v", err))
		return
	}

	seenNames := make(map[string]bool)
	var proxyNames []string
	for _, provider := range providersResp.Providers {
		for _, proxy := range provider.Proxies {
			if !seenNames[proxy.Name] {
				seenNames[proxy.Name] = true
				proxyNames = append(proxyNames, proxy.Name)
			}
		}
	}

	result := BatchGeoResult{
		Results:   make([]ProxyGeoResult, 0, len(proxyNames)),
		ByCountry: make(map[string]int),
		Total:     len(proxyNames),
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 3)

	for _, name := range proxyNames {
		wg.Add(1)
		go func(proxyName string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			geoResult := ProxyGeoResult{Name: proxyName}
			geoInfo, err := s.getProxyGeoInfo(proxyName, proxyPort)
			if err != nil {
				geoResult.Error = err.Error()
				mu.Lock()
				result.Failed++
				result.Results = append(result.Results, geoResult)
				mu.Unlock()
				return
			}

			geoResult.Country = geoInfo.Country
			geoResult.Region = geoInfo.Region
			geoResult.City = geoInfo.City
			geoResult.IP = geoInfo.IP
			geoResult.Source = geoInfo.Source

			mu.Lock()
			result.Success++
			result.Results = append(result.Results, geoResult)
			if geoInfo.Country != "" {
				result.ByCountry[geoInfo.Country]++
			}
			mu.Unlock()
		}(name)
	}

	wg.Wait()

	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleGeoDiagnostics(w http.ResponseWriter, r *http.Request) {
	proxyPort, err := s.getMihomoProxyPort()
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get proxy port: %v", err))
		return
	}

	status, body, err := s.forwardMihomo("GET", "/providers/proxies", nil)
	if err != nil {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("failed to get providers: %v", err))
		return
	}
	if status != 200 {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("providers returned status %d", status))
		return
	}

	var providersResp struct {
		Providers map[string]struct {
			Proxies []struct {
				Name string `json:"name"`
			} `json:"proxies"`
		} `json:"providers"`
	}
	if err := json.Unmarshal([]byte(body), &providersResp); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to parse providers: %v", err))
		return
	}

	seenNames := make(map[string]bool)
	var proxyNames []string
	for _, provider := range providersResp.Providers {
		for _, proxy := range provider.Proxies {
			if !seenNames[proxy.Name] {
				seenNames[proxy.Name] = true
				proxyNames = append(proxyNames, proxy.Name)
			}
		}
	}

	byCountry := make(map[string][]string)
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 3)

	for _, name := range proxyNames {
		wg.Add(1)
		go func(proxyName string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			geoInfo, err := s.getProxyGeoInfo(proxyName, proxyPort)
			if err != nil {
				return
			}

			if geoInfo.Country != "" {
				mu.Lock()
				byCountry[geoInfo.Country] = append(byCountry[geoInfo.Country], proxyName)
				mu.Unlock()
			}
		}(name)
	}

	wg.Wait()

	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to read config: %v", err))
		return
	}

	proxyGroups := mappingValue(root, "proxy-groups")
	existingGroups := make(map[string]bool)
	regionGroups := make(map[string][]string)

	if proxyGroups != nil && proxyGroups.Kind == yaml.SequenceNode {
		for _, group := range proxyGroups.Content {
			name := childScalar(group, "name")
			if name != "" {
				existingGroups[name] = true
			}
		}
	}

	for country, nodes := range byCountry {
		groupName := country
		if !existingGroups[groupName] {
			regionGroups[country] = nodes
		}
	}

	result := struct {
		NodesByCountry map[string][]string `json:"nodesByCountry"`
		MissingGroups  map[string][]string `json:"missingGroups"`
		ExistingGroups []string            `json:"existingGroups"`
		Suggestions    []string            `json:"suggestions"`
	}{
		NodesByCountry: byCountry,
		MissingGroups:  regionGroups,
		ExistingGroups: func() []string {
			var names []string
			for name := range existingGroups {
				names = append(names, name)
			}
			return names
		}(),
		Suggestions: func() []string {
			var suggestions []string
			for country := range regionGroups {
				suggestions = append(suggestions, fmt.Sprintf("建议创建策略组 %s 包含 %d 个节点", country, len(byCountry[country])))
			}
			return suggestions
		}(),
	}

	writeJSON(w, http.StatusOK, result)
}
