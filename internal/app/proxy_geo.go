package app

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const geoCacheDuration = 24 * time.Hour

type GeoInfo struct {
	Country string `json:"country"`
	Region  string `json:"region"`
	City    string `json:"city"`
	ISP     string `json:"org"`
	IP      string `json:"ip"`
}

func (s *Server) handleProxyGeo(w http.ResponseWriter, r *http.Request) {
	proxyName := r.PathValue("name")
	if proxyName == "" {
		writeError(w, http.StatusBadRequest, "proxy name is required")
		return
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
	cacheKey := proxyName
	if cached, ok := s.geoCache.Load(cacheKey); ok {
		if entry, ok := cached.(*geoCacheEntry); ok && time.Now().Before(entry.expiresAt) {
			return entry.info, nil
		}
	}

	s.geoMu.Lock()
	defer s.geoMu.Unlock()

	if cached, ok := s.geoCache.Load(cacheKey); ok {
		if entry, ok := cached.(*geoCacheEntry); ok && time.Now().Before(entry.expiresAt) {
			return entry.info, nil
		}
	}

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

	client := &http.Client{
		Transport: &http.Transport{
			Proxy:           http.ProxyURL(proxy),
			TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
		},
		Timeout: 15 * time.Second,
	}

	req, err := http.NewRequest("GET", "https://ipinfo.io/json", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "curl/7.68.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request via proxy: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var geoInfo GeoInfo
	if err := json.Unmarshal(data, &geoInfo); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	s.geoCache.Store(cacheKey, &geoCacheEntry{
		info:      &geoInfo,
		expiresAt: time.Now().Add(geoCacheDuration),
	})

	return &geoInfo, nil
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
