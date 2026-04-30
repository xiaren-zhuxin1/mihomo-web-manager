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

func (s *Server) getProxyGeoInfo(proxyName string, proxyPort int) (*GeoInfo, error) {
	cacheKey := proxyName
	if cached, ok := s.geoCache.Load(cacheKey); ok {
		if entry, ok := cached.(*geoCacheEntry); ok && time.Now().Before(entry.expiresAt) {
			return entry.info, nil
		}
	}

	proxyURL := fmt.Sprintf("http://127.0.0.1:%d", proxyPort)

	proxy, err := url.Parse(proxyURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse proxy URL: %w", err)
	}

	client := &http.Client{
		Transport: &http.Transport{
			Proxy:           http.ProxyURL(proxy),
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		Timeout: 15 * time.Second,
	}

	req, err := http.NewRequest("GET", "https://ipinfo.io/json", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "curl/7.68.0")

	originalNow, err := s.getCurrentProxy("Proxy")
	if err != nil {
		originalNow = ""
	}

	if err := s.switchProxy("Proxy", proxyName); err != nil {
		return nil, fmt.Errorf("failed to switch proxy: %w", err)
	}

	defer func() {
		if originalNow != "" {
			s.switchProxy("Proxy", originalNow)
		}
	}()

	time.Sleep(100 * time.Millisecond)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
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
	status, _, err := s.forwardMihomo("PUT", "/proxies/"+url.PathEscape(groupName), strings.NewReader(body))
	if err != nil {
		return err
	}
	if status != 204 && status != 200 {
		return fmt.Errorf("status %d", status)
	}
	return nil
}
