package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type proxyRegionCache struct {
	mu      sync.RWMutex
	regions map[string]string
	updated time.Time
}

var regionCache = &proxyRegionCache{
	regions: make(map[string]string),
}

func (s *Server) handleProxyRegions(w http.ResponseWriter, r *http.Request) {
	regionCache.mu.RLock()
	cached := make(map[string]string, len(regionCache.regions))
	for k, v := range regionCache.regions {
		cached[k] = v
	}
	age := time.Since(regionCache.updated)
	regionCache.mu.RUnlock()

	if len(cached) > 0 && age < 10*time.Minute {
		writeJSON(w, http.StatusOK, map[string]any{"regions": cached, "cached": true})
		return
	}

	regions := s.detectAllRegions()

	regionCache.mu.Lock()
	regionCache.regions = regions
	regionCache.updated = time.Now()
	regionCache.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"regions": regions, "cached": false})
}

func (s *Server) detectAllRegions() map[string]string {
	status, body, err := s.forwardMihomo("GET", "/proxies", nil)
	if err != nil || status >= 300 {
		return map[string]string{}
	}

	var result struct {
		Proxies map[string]struct {
			Type    string   `json:"type"`
			All     []string `json:"all"`
			Now     string   `json:"now"`
			Hidden  bool     `json:"hidden"`
		} `json:"proxies"`
	}
	if err := json.Unmarshal([]byte(body), &result); err != nil {
		return map[string]string{}
	}

	regions := make(map[string]string)

	for name := range result.Proxies {
		if r := extractRegionFromName(name); r != "" {
			regions[name] = r
		}
	}

	type nodeGroup struct {
		nodeName string
		groups   []string
	}

	var unknownNodes []nodeGroup
	for gName, proxy := range result.Proxies {
		if proxy.Type != "Selector" || proxy.Hidden {
			continue
		}
		for _, member := range proxy.All {
			if regions[member] != "" {
				continue
			}
			if !isConcreteProxyType(result.Proxies[member].Type) {
				continue
			}
			unknownNodes = append(unknownNodes, nodeGroup{nodeName: member, groups: []string{gName}})
		}
	}

	if len(unknownNodes) == 0 {
		return regions
	}

	proxyAddr := s.proxyListenAddr()

	type regionResult struct {
		name   string
		region string
	}

	ch := make(chan regionResult, len(unknownNodes))
	sem := make(chan struct{}, 1)

	for _, task := range unknownNodes {
		sem <- struct{}{}
		go func(t nodeGroup) {
			defer func() { <-sem }()
			r := s.detectRegionBySwitching(t.nodeName, t.groups, result.Proxies, proxyAddr)
			ch <- regionResult{name: t.nodeName, region: r}
		}(task)
	}

	for i := 0; i < len(unknownNodes); i++ {
		res := <-ch
		if res.region != "" {
			regions[res.name] = res.region
		}
	}

	return regions
}

func (s *Server) proxyListenAddr() string {
	controller := s.cfg.MihomoController
	u, err := url.Parse(controller)
	if err != nil {
		return "http://127.0.0.1:7890"
	}
	host := u.Hostname()
	if host == "" {
		host = "127.0.0.1"
	}
	return fmt.Sprintf("http://%s:7890", host)
}

func (s *Server) detectRegionBySwitching(nodeName string, groupNames []string,
	allProxies map[string]struct {
		Type    string   `json:"type"`
		All     []string `json:"all"`
		Now     string   `json:"now"`
		Hidden  bool     `json:"hidden"`
	}, proxyAddr string) string {

	if len(groupNames) == 0 {
		return ""
	}

	groupName := groupNames[0]
	originalNow := allProxies[groupName].Now

	switchPayload, _ := json.Marshal(map[string]string{"name": nodeName})
	_, _, err := s.forwardMihomo("PUT", fmt.Sprintf("/proxies/%s", url.PathEscape(groupName)), strings.NewReader(string(switchPayload)))
	if err != nil {
		return ""
	}

	time.Sleep(300 * time.Millisecond)

	countryCode := ""
	client := &http.Client{Timeout: 10 * time.Second, Transport: &http.Transport{
		Proxy: func(req *http.Request) (*url.URL, error) {
			return url.Parse(proxyAddr)
		},
	}}
	resp, err := client.Get("http://ip-api.com/json/?fields=countryCode")
	if err == nil {
		defer resp.Body.Close()
		var ipInfo struct {
			CountryCode string `json:"countryCode"`
		}
		if json.NewDecoder(resp.Body).Decode(&ipInfo) == nil && ipInfo.CountryCode != "" {
			countryCode = ipInfo.CountryCode
		}
	}

	restorePayload, _ := json.Marshal(map[string]string{"name": originalNow})
	s.forwardMihomo("PUT", fmt.Sprintf("/proxies/%s", url.PathEscape(groupName)), strings.NewReader(string(restorePayload)))

	if countryCode == "" {
		return ""
	}

	return countryCodeToFlag(countryCode)
}

func isConcreteProxyType(t string) bool {
	switch strings.ToLower(t) {
	case "shadowsocks", "vmess", "vless", "trojan", "hysteria", "hysteria2",
		"tuic", "wireguard", "ss", "ssr", "snell", "http", "socks5":
		return true
	}
	return false
}

func extractRegionFromName(name string) string {
	for _, r := range name {
		if r >= 0x1F1E6 && r <= 0x1F1FF {
			var flags []rune
			for _, c := range name {
				if c >= 0x1F1E6 && c <= 0x1F1FF {
					flags = append(flags, c)
				}
			}
			if len(flags) >= 2 {
				return string(flags[:2])
			}
		}
	}

	regionKeywords := map[string]string{
		"香港": "🇭🇰", "Hong Kong": "🇭🇰",
		"台湾": "🇹🇼", "Taiwan": "🇹🇼",
		"日本": "🇯🇵", "Japan": "🇯🇵", "东京": "🇯🇵", "大阪": "🇯🇵",
		"新加坡": "🇸🇬", "Singapore": "🇸🇬",
		"美国": "🇺🇸", "USA": "🇺🇸", "United States": "🇺🇸",
		"洛杉矶": "🇺🇸", "硅谷": "🇺🇸", "圣何塞": "🇺🇸", "西雅图": "🇺🇸",
		"韩国": "🇰🇷", "Korea": "🇰🇷", "首尔": "🇰🇷",
		"英国": "🇬🇧", "UK": "🇬🇧", "GB": "🇬🇧", "London": "🇬🇧",
		"德国": "🇩🇪", "Germany": "🇩🇪", "法兰克福": "🇩🇪",
		"法国": "🇫🇷", "France": "🇫🇷", "巴黎": "🇫🇷",
		"加拿大": "🇨🇦", "Canada": "🇨🇦",
		"澳大利亚": "🇦🇺", "Australia": "🇦🇺",
		"俄罗斯": "🇷🇺", "Russia": "🇷🇺",
		"印度": "🇮🇳", "India": "🇮🇳",
		"巴西": "🇧🇷", "Brazil": "🇧🇷",
		"土耳其": "🇹🇷", "Turkey": "🇹🇷",
		"荷兰": "🇳🇱", "Netherlands": "🇳🇱",
		"阿根廷": "🇦🇷",
		"泰国": "🇹🇭",
		"越南": "🇻🇳",
		"菲律宾": "🇵🇭",
		"马来西亚": "🇲🇾",
		"印尼": "🇮🇩", "印度尼西亚": "🇮🇩",
	}

	for keyword, flag := range regionKeywords {
		if strings.Contains(name, keyword) {
			return flag
		}
	}

	return ""
}

func countryCodeToFlag(code string) string {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) != 2 {
		return ""
	}
	r1 := rune(code[0]) - 'A' + 0x1F1E6
	r2 := rune(code[1]) - 'A' + 0x1F1E6
	return string([]rune{r1, r2})
}
