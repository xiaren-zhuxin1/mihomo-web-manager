package app

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type ProviderIssue struct {
	Type        string `json:"type"`
	Severity    string `json:"severity"`
	Provider    string `json:"provider"`
	Message     string `json:"message"`
	FileExists  bool   `json:"fileExists"`
	CanAutoFix  bool   `json:"canAutoFix"`
	UsedByGroup string `json:"usedByGroup,omitempty"`
}

type SubRoutingIssue struct {
	Type       string `json:"type"`
	Severity   string `json:"severity"`
	Domain     string `json:"domain"`
	SubName    string `json:"subName"`
	SubURL     string `json:"subURL"`
	Message    string `json:"message"`
	CanAutoFix bool   `json:"canAutoFix"`
}

type ProviderDiagnostics struct {
	Issues            []SubRoutingIssue `json:"issues"`
	CanFixAll         bool              `json:"canFixAll"`
	ProviderIssues    []ProviderIssue   `json:"providerIssues"`
	CanFixAllProvider bool              `json:"canFixAllProvider"`
}

func (s *Server) handleProviderDiagnostics(w http.ResponseWriter, r *http.Request) {
	diagnostics := s.runProviderDiagnostics()
	writeJSON(w, http.StatusOK, diagnostics)
}

func (s *Server) handleProviderAutofix(w http.ResponseWriter, r *http.Request) {
	diagnostics := s.runProviderDiagnostics()
	hasIssues := len(diagnostics.Issues) > 0 || len(diagnostics.ProviderIssues) > 0
	if !hasIssues {
		writeJSON(w, http.StatusOK, map[string]any{"fixed": false, "message": "没有需要修复的问题"})
		return
	}

	fixed := []string{}
	errors := []string{}

	for _, issue := range diagnostics.ProviderIssues {
		if !issue.CanAutoFix {
			continue
		}
		if err := s.fixProviderIssue(issue); err != nil {
			errors = append(errors, issue.Provider+": "+err.Error())
		} else {
			fixed = append(fixed, "provider:"+issue.Provider)
		}
	}

	for _, issue := range diagnostics.Issues {
		if !issue.CanAutoFix {
			continue
		}
		if err := s.fixSubRoutingIssue(issue); err != nil {
			errors = append(errors, issue.Domain+": "+err.Error())
		} else {
			fixed = append(fixed, "rule:"+issue.Domain)
		}
	}

	if len(fixed) > 0 {
		if _, _, err := s.reloadMihomo(); err != nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"fixed":       len(fixed) > 0,
				"items":       fixed,
				"reloadError": err.Error(),
			})
			return
		}
	}

	result := map[string]any{
		"fixed": len(fixed) > 0,
		"items": fixed,
	}
	if len(errors) > 0 {
		result["errors"] = errors
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) runProviderDiagnostics() ProviderDiagnostics {
	providerIssues := s.checkProviderDefinitions()
	subIssues := s.checkSubscriptionRouting()

	canFixAll := true
	for _, issue := range subIssues {
		if !issue.CanAutoFix {
			canFixAll = false
			break
		}
	}
	canFixAllProvider := true
	for _, issue := range providerIssues {
		if !issue.CanAutoFix {
			canFixAllProvider = false
			break
		}
	}

	return ProviderDiagnostics{
		Issues:            subIssues,
		CanFixAll:         canFixAll,
		ProviderIssues:    providerIssues,
		CanFixAllProvider: canFixAllProvider,
	}
}

func (s *Server) checkProviderDefinitions() []ProviderIssue {
	issues := []ProviderIssue{}

	root, err := s.readConfigYAML()
	if err != nil {
		return []ProviderIssue{{
			Type:     "config_read_error",
			Severity: "critical",
			Message:  "无法读取配置文件: " + err.Error(),
		}}
	}

	definedProviders := map[string]bool{}
	providers := mappingValue(root, "proxy-providers")
	if providers != nil && providers.Kind == yaml.MappingNode {
		for i := 0; i+1 < len(providers.Content); i += 2 {
			name := providers.Content[i].Value
			definedProviders[name] = true
		}
	}

	usedProviders := map[string][]string{}
	groups := mappingValue(root, "proxy-groups")
	if groups != nil && groups.Kind == yaml.SequenceNode {
		for _, group := range groups.Content {
			if group.Kind != yaml.MappingNode {
				continue
			}
			groupName := ""
			for i := 0; i+1 < len(group.Content); i += 2 {
				key := group.Content[i].Value
				if key == "name" {
					groupName = group.Content[i+1].Value
				}
				if key == "use" {
					useNode := group.Content[i+1]
					if useNode.Kind == yaml.SequenceNode {
						for _, p := range useNode.Content {
							providerName := p.Value
							if providerName != "" && providerName != "all" {
								usedProviders[providerName] = append(usedProviders[providerName], groupName)
							}
						}
					}
				}
			}
		}
	}

	configDir := filepath.Dir(s.cfg.MihomoConfigPath)

	for providerName, usedBy := range usedProviders {
		if definedProviders[providerName] {
			continue
		}

		providerPath := filepath.Join(configDir, "proxy-providers", providerName+".yaml")
		fileExists := false
		if _, err := os.Stat(providerPath); err == nil {
			fileExists = true
		}

		issue := ProviderIssue{
			Type:        "provider_not_defined",
			Severity:    "critical",
			Provider:    providerName,
			Message:     "策略组引用的 provider '" + providerName + "' 未在 proxy-providers 中定义",
			FileExists:  fileExists,
			CanAutoFix:  fileExists,
			UsedByGroup: strings.Join(usedBy, ", "),
		}
		issues = append(issues, issue)
	}

	return issues
}

func (s *Server) checkSubscriptionRouting() []SubRoutingIssue {
	issues := []SubRoutingIssue{}

	items, err := s.loadSubscriptions()
	if err != nil || len(items) == 0 {
		return issues
	}

	root, err := s.readConfigYAML()
	if err != nil {
		return issues
	}

	rules := mappingValue(root, "rules")
	existingDirectDomains := map[string]bool{}
	if rules != nil && rules.Kind == yaml.SequenceNode {
		for _, rule := range rules.Content {
			parts := strings.Split(rule.Value, ",")
			if len(parts) >= 3 && (parts[0] == "DOMAIN" || parts[0] == "DOMAIN-SUFFIX") && parts[2] == "DIRECT" {
				existingDirectDomains[parts[1]] = true
			}
		}
	}

	fakeIPFilter := mappingValue(mappingValue(root, "dns"), "fake-ip-filter")
	existingFakeIPFilters := map[string]bool{}
	if fakeIPFilter != nil && fakeIPFilter.Kind == yaml.SequenceNode {
		for _, f := range fakeIPFilter.Content {
			existingFakeIPFilters[strings.TrimPrefix(strings.TrimPrefix(f.Value, "+."), "*.")] = true
		}
	}

	for _, item := range items {
		if item.URL == "" || !item.Managed {
			continue
		}
		if item.LastStatus == "updated" && item.Error == "" {
			continue
		}

		parsed, parseErr := url.Parse(item.URL)
		if parseErr != nil {
			continue
		}
		domain := parsed.Hostname()
		if domain == "" {
			continue
		}

		suffixParts := strings.Split(domain, ".")
		var baseDomain string
		if len(suffixParts) >= 2 {
			baseDomain = strings.Join(suffixParts[len(suffixParts)-2:], ".")
		}

		inFakeIPFilter := false
		for f := range existingFakeIPFilters {
			if f == baseDomain || f == domain || strings.HasSuffix(domain, "."+f) {
				inFakeIPFilter = true
				break
			}
		}

		if !inFakeIPFilter && (strings.Contains(item.Error, "fake-ip") || strings.Contains(item.Error, "198.18.") || strings.Contains(item.Error, "EOF")) {
			issues = append(issues, SubRoutingIssue{
				Type:       "sub_fakeip_blocked",
				Severity:   "warning",
				Domain:     domain,
				SubName:    item.Name,
				SubURL:     item.URL,
				Message:    fmt.Sprintf("订阅 '%s' 的域名 %s 被 fake-ip 影响导致刷新失败，需要添加到 fake-ip-filter", item.Name, domain),
				CanAutoFix: true,
			})
			continue
		}

		if existingDirectDomains[domain] {
			continue
		}

		alreadyCovered := false
		for d := range existingDirectDomains {
			if d == baseDomain || strings.HasSuffix(domain, "."+d) {
				alreadyCovered = true
				break
			}
		}
		if alreadyCovered {
			continue
		}

		issues = append(issues, SubRoutingIssue{
			Type:       "sub_routing_blocked",
			Severity:   "warning",
			Domain:     domain,
			SubName:    item.Name,
			SubURL:     item.URL,
			Message:    fmt.Sprintf("订阅 '%s' 的域名 %s 可能被代理规则拦截导致刷新失败，建议添加直连规则", item.Name, domain),
			CanAutoFix: true,
		})
	}

	return issues
}

func (s *Server) fixProviderIssue(issue ProviderIssue) error {
	if issue.Type != "provider_not_defined" || !issue.FileExists {
		return nil
	}

	root, err := s.readConfigYAML()
	if err != nil {
		return err
	}

	providers := ensureMapping(root, "proxy-providers")

	removeMappingKey(providers, issue.Provider)
	providers.Content = append(providers.Content, scalar(issue.Provider), &yaml.Node{
		Kind: yaml.MappingNode,
		Content: []*yaml.Node{
			scalar("type"), scalar("file"),
			scalar("path"), scalar("./proxy-providers/" + issue.Provider + ".yaml"),
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

	return s.writeConfigYAML(root)
}

func (s *Server) fixSubRoutingIssue(issue SubRoutingIssue) error {
	if issue.Type == "sub_fakeip_blocked" {
		return s.fixFakeIPFilter(issue)
	}
	if issue.Type != "sub_routing_blocked" {
		return nil
	}

	root, err := s.readConfigYAML()
	if err != nil {
		return err
	}

	rules := ensureSequence(root, "rules")

	domainRule := "DOMAIN," + issue.Domain + ",DIRECT"
	for _, rule := range rules.Content {
		if rule.Value == domainRule {
			return nil
		}
	}

	newRule := &yaml.Node{Kind: yaml.ScalarNode, Value: domainRule}
	rules.Content = append([]*yaml.Node{newRule}, rules.Content...)

	return s.writeConfigYAML(root)
}

func (s *Server) fixFakeIPFilter(issue SubRoutingIssue) error {
	root, err := s.readConfigYAML()
	if err != nil {
		return err
	}

	dnsNode := ensureMapping(root, "dns")
	filter := mappingValue(dnsNode, "fake-ip-filter")
	if filter == nil || filter.Kind != yaml.SequenceNode {
		filter = &yaml.Node{Kind: yaml.SequenceNode}
		for i := 0; i+1 < len(dnsNode.Content); i += 2 {
			if dnsNode.Content[i].Value == "fake-ip-filter" {
				dnsNode.Content[i+1] = filter
				break
			}
		}
		if filter.HeadComment == "" {
			dnsNode.Content = append(dnsNode.Content, scalar("fake-ip-filter"), filter)
		}
	}

	suffixParts := strings.Split(issue.Domain, ".")
	var baseDomain string
	if len(suffixParts) >= 2 {
		baseDomain = strings.Join(suffixParts[len(suffixParts)-2:], ".")
	}
	filterEntry := "+." + baseDomain

	for _, f := range filter.Content {
		if f.Value == filterEntry || f.Value == issue.Domain {
			return nil
		}
	}

	filter.Content = append(filter.Content, scalar(filterEntry))

	return s.writeConfigYAML(root)
}
