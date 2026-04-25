package app

import (
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

type configProxyGroup struct {
	Name     string   `json:"name"`
	Type     string   `json:"type"`
	Proxies  []string `json:"proxies"`
	Use      []string `json:"use"`
	URL      string   `json:"url,omitempty"`
	Interval string   `json:"interval,omitempty"`
	Filter   string   `json:"filter,omitempty"`
}

type configRuleProvider struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Behavior string `json:"behavior"`
	URL      string `json:"url,omitempty"`
	Path     string `json:"path,omitempty"`
	Interval string `json:"interval,omitempty"`
}

type configValidationIssue struct {
	Level   string `json:"level"`
	Scope   string `json:"scope"`
	Name    string `json:"name"`
	Message string `json:"message"`
}

var configNamePattern = regexp.MustCompile(`^[\p{L}\p{N} _.\-()!@]+$`)

func (s *Server) handleConfigModel(w http.ResponseWriter, r *http.Request) {
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"proxyGroups":   readProxyGroups(root),
		"proxyProviders": readMappingKeys(root, "proxy-providers"),
		"rules":         readRuleStrings(root),
		"ruleProviders": readRuleProviders(root),
	})
}

func (s *Server) handleValidateConfigModel(w http.ResponseWriter, r *http.Request) {
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	issues := validateConfigModel(readProxyGroups(root), readRuleStrings(root), readRuleProviders(root))
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     len(errorIssues(issues)) == 0,
		"issues": issues,
	})
}

func (s *Server) handleUpsertProxyGroup(w http.ResponseWriter, r *http.Request) {
	var item configProxyGroup
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if item.Name == "" {
		item.Name = r.PathValue("name")
	}
	if strings.TrimSpace(item.Name) == "" || strings.TrimSpace(item.Type) == "" {
		writeError(w, http.StatusBadRequest, "proxy group name and type are required")
		return
	}
	if !validConfigName(item.Name) {
		writeError(w, http.StatusBadRequest, "proxy group name contains unsupported characters")
		return
	}
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	groups := ensureSequence(root, "proxy-groups")
	upsertNamedSequenceItem(groups, item.Name, proxyGroupNode(item))
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"saved": true})
}

func (s *Server) handleDeleteProxyGroup(w http.ResponseWriter, r *http.Request) {
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	removeNamedSequenceItem(mappingValue(root, "proxy-groups"), r.PathValue("name"))
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

func (s *Server) handleMoveProxyGroup(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Direction string `json:"direction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	seq := ensureSequence(root, "proxy-groups")
	if !moveNamedSequenceItem(seq, r.PathValue("name"), payload.Direction) {
		writeError(w, http.StatusBadRequest, "proxy group cannot be moved")
		return
	}
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"moved": true})
}

func (s *Server) handleAddConfigRule(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Rule  string `json:"rule"`
		Index *int   `json:"index"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if strings.TrimSpace(payload.Rule) == "" {
		writeError(w, http.StatusBadRequest, "rule is required")
		return
	}
	if !validRuleString(payload.Rule) {
		writeError(w, http.StatusBadRequest, "invalid rule format")
		return
	}
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	rules := ensureSequence(root, "rules")
	node := scalar(payload.Rule)
	if payload.Index != nil && *payload.Index >= 0 && *payload.Index <= len(rules.Content) {
		rules.Content = append(rules.Content[:*payload.Index], append([]*yaml.Node{node}, rules.Content[*payload.Index:]...)...)
	} else {
		rules.Content = append(rules.Content, node)
	}
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"saved": true})
}

func (s *Server) handleUpdateConfigRule(w http.ResponseWriter, r *http.Request) {
	index, ok := parseIndex(r.PathValue("index"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid rule index")
		return
	}
	var payload struct {
		Rule string `json:"rule"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if !validRuleString(payload.Rule) {
		writeError(w, http.StatusBadRequest, "invalid rule format")
		return
	}
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	rules := ensureSequence(root, "rules")
	if index < 0 || index >= len(rules.Content) {
		writeError(w, http.StatusNotFound, "rule index not found")
		return
	}
	rules.Content[index] = scalar(payload.Rule)
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"saved": true})
}

func (s *Server) handleMoveConfigRule(w http.ResponseWriter, r *http.Request) {
	index, ok := parseIndex(r.PathValue("index"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid rule index")
		return
	}
	var payload struct {
		Direction string `json:"direction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	rules := ensureSequence(root, "rules")
	if !moveSequenceItem(rules, index, payload.Direction) {
		writeError(w, http.StatusBadRequest, "rule cannot be moved")
		return
	}
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"moved": true})
}

func (s *Server) handleDeleteConfigRule(w http.ResponseWriter, r *http.Request) {
	index, ok := parseIndex(r.PathValue("index"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid rule index")
		return
	}
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	rules := ensureSequence(root, "rules")
	if index < 0 || index >= len(rules.Content) {
		writeError(w, http.StatusNotFound, "rule index not found")
		return
	}
	rules.Content = append(rules.Content[:index], rules.Content[index+1:]...)
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

func (s *Server) handleUpsertRuleProvider(w http.ResponseWriter, r *http.Request) {
	var item configRuleProvider
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if item.Name == "" {
		item.Name = r.PathValue("name")
	}
	if strings.TrimSpace(item.Name) == "" {
		writeError(w, http.StatusBadRequest, "rule provider name is required")
		return
	}
	if !validConfigName(item.Name) {
		writeError(w, http.StatusBadRequest, "rule provider name contains unsupported characters")
		return
	}
	if err := validateRuleProviderInput(item); err != "" {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	providers := ensureMapping(root, "rule-providers")
	removeMappingKey(providers, item.Name)
	providers.Content = append(providers.Content, scalar(item.Name), ruleProviderNode(item))
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"saved": true})
}

func (s *Server) handleDeleteRuleProvider(w http.ResponseWriter, r *http.Request) {
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	removeMappingKey(ensureMapping(root, "rule-providers"), r.PathValue("name"))
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.reloadMihomo()
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

func readProxyGroups(root *yaml.Node) []configProxyGroup {
	seq := mappingValue(root, "proxy-groups")
	if seq == nil || seq.Kind != yaml.SequenceNode {
		return nil
	}
	items := make([]configProxyGroup, 0, len(seq.Content))
	for _, node := range seq.Content {
		items = append(items, configProxyGroup{
			Name:     childScalar(node, "name"),
			Type:     childScalar(node, "type"),
			Proxies:  childScalars(node, "proxies"),
			Use:      childScalars(node, "use"),
			URL:      childScalar(node, "url"),
			Interval: childScalar(node, "interval"),
			Filter:   childScalar(node, "filter"),
		})
	}
	return items
}

func readRuleStrings(root *yaml.Node) []string {
	seq := mappingValue(root, "rules")
	if seq == nil || seq.Kind != yaml.SequenceNode {
		return nil
	}
	items := make([]string, 0, len(seq.Content))
	for _, node := range seq.Content {
		items = append(items, node.Value)
	}
	return items
}

func readRuleProviders(root *yaml.Node) []configRuleProvider {
	providers := mappingValue(root, "rule-providers")
	if providers == nil || providers.Kind != yaml.MappingNode {
		return nil
	}
	items := make([]configRuleProvider, 0, len(providers.Content)/2)
	for i := 0; i+1 < len(providers.Content); i += 2 {
		node := providers.Content[i+1]
		items = append(items, configRuleProvider{
			Name:     providers.Content[i].Value,
			Type:     childScalar(node, "type"),
			Behavior: childScalar(node, "behavior"),
			URL:      childScalar(node, "url"),
			Path:     childScalar(node, "path"),
			Interval: childScalar(node, "interval"),
		})
	}
	return items
}

func readMappingKeys(root *yaml.Node, key string) []string {
	node := mappingValue(root, key)
	if node == nil || node.Kind != yaml.MappingNode {
		return nil
	}
	items := make([]string, 0, len(node.Content)/2)
	for i := 0; i+1 < len(node.Content); i += 2 {
		items = append(items, node.Content[i].Value)
	}
	return items
}

func validateConfigModel(groups []configProxyGroup, rules []string, providers []configRuleProvider) []configValidationIssue {
	issues := []configValidationIssue{}
	groupNames := map[string]bool{}
	providerNames := map[string]bool{}
	targetNames := map[string]bool{"DIRECT": true, "REJECT": true, "REJECT-DROP": true, "GLOBAL": true}
	for _, group := range groups {
		if group.Name == "" {
			issues = appendIssue(issues, "error", "proxy-group", "-", "策略组缺少 name")
			continue
		}
		if !validConfigName(group.Name) {
			issues = appendIssue(issues, "error", "proxy-group", group.Name, "策略组名称包含不支持的特殊字符")
		}
		if groupNames[group.Name] {
			issues = appendIssue(issues, "error", "proxy-group", group.Name, "策略组名称重复")
		}
		groupNames[group.Name] = true
		targetNames[group.Name] = true
		if group.Type == "" {
			issues = appendIssue(issues, "error", "proxy-group", group.Name, "策略组缺少 type")
		}
		if len(group.Proxies) == 0 && len(group.Use) == 0 && group.Type != "relay" {
			issues = appendIssue(issues, "warning", "proxy-group", group.Name, "策略组没有 proxies/use，可能没有可选节点")
		}
	}
	for _, provider := range providers {
		if provider.Name == "" {
			issues = appendIssue(issues, "error", "rule-provider", "-", "rule-provider 缺少名称")
			continue
		}
		if !validConfigName(provider.Name) {
			issues = appendIssue(issues, "error", "rule-provider", provider.Name, "rule-provider 名称包含不支持的特殊字符")
		}
		if providerNames[provider.Name] {
			issues = appendIssue(issues, "error", "rule-provider", provider.Name, "rule-provider 名称重复")
		}
		providerNames[provider.Name] = true
		if provider.Type == "http" && provider.URL == "" {
			issues = appendIssue(issues, "error", "rule-provider", provider.Name, "http rule-provider 缺少 url")
		}
		if provider.Type == "http" && provider.URL != "" && !validHTTPURL(provider.URL) {
			issues = appendIssue(issues, "error", "rule-provider", provider.Name, "http rule-provider URL 必须是 http/https")
		}
		if provider.Type == "file" && provider.Path == "" {
			issues = appendIssue(issues, "error", "rule-provider", provider.Name, "file rule-provider 缺少 path")
		}
	}
	for _, group := range groups {
		for _, usedProvider := range group.Use {
			// proxy-provider is outside this model, so only flag empty values here.
			if strings.TrimSpace(usedProvider) == "" {
				issues = appendIssue(issues, "warning", "proxy-group", group.Name, "use 包含空 provider")
			}
		}
		for _, proxy := range group.Proxies {
			if proxy == group.Name {
				issues = appendIssue(issues, "error", "proxy-group", group.Name, "proxies 不能引用自己")
			}
		}
	}
	for index, rule := range rules {
		parts := splitRule(rule)
		name := "#" + strconv.Itoa(index)
		if !validRuleString(rule) {
			issues = appendIssue(issues, "error", "rule", name, "规则字段过少")
			continue
		}
		kind := strings.ToUpper(parts[0])
		if kind == "MATCH" {
			if len(parts) < 2 || !targetNames[parts[len(parts)-1]] {
				issues = appendIssue(issues, "warning", "rule", name, "MATCH 目标策略不存在或不可识别")
			}
			continue
		}
		if len(parts) < 3 {
			issues = appendIssue(issues, "error", "rule", name, "规则缺少目标策略")
			continue
		}
		target := ruleTarget(kind, parts)
		if kind == "RULE-SET" && !providerNames[parts[1]] {
			issues = appendIssue(issues, "error", "rule", name, "RULE-SET 引用了不存在的 rule-provider: "+parts[1])
		}
		if !targetNames[target] {
			issues = appendIssue(issues, "warning", "rule", name, "目标策略不存在或不可识别: "+target)
		}
	}
	return issues
}

func splitRule(rule string) []string {
	parts := strings.Split(rule, ",")
	clean := make([]string, 0, len(parts))
	for _, part := range parts {
		clean = append(clean, strings.TrimSpace(part))
	}
	return clean
}

func ruleTarget(kind string, parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	if kind == "MATCH" {
		if len(parts) >= 2 {
			return parts[1]
		}
		return ""
	}
	if len(parts) >= 3 {
		return parts[2]
	}
	return ""
}

func validConfigName(value string) bool {
	return configNamePattern.MatchString(strings.TrimSpace(value))
}

func validRuleString(rule string) bool {
	parts := splitRule(rule)
	if len(parts) == 0 || parts[0] == "" {
		return false
	}
	if strings.ToUpper(parts[0]) == "MATCH" {
		return len(parts) >= 2 && parts[1] != ""
	}
	return len(parts) >= 3 && parts[1] != "" && parts[2] != ""
}

func validateRuleProviderInput(item configRuleProvider) string {
	if item.Type == "http" && !validHTTPURL(item.URL) {
		return "http rule provider requires http/https url"
	}
	if item.Type == "file" && strings.TrimSpace(item.Path) == "" {
		return "file rule provider requires path"
	}
	if item.Interval != "" {
		if _, err := strconv.Atoi(item.Interval); err != nil {
			return "interval must be seconds"
		}
	}
	return ""
}

func validHTTPURL(value string) bool {
	parsed, err := url.Parse(value)
	return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}

func appendIssue(issues []configValidationIssue, level string, scope string, name string, message string) []configValidationIssue {
	return append(issues, configValidationIssue{Level: level, Scope: scope, Name: name, Message: message})
}

func errorIssues(issues []configValidationIssue) []configValidationIssue {
	errors := []configValidationIssue{}
	for _, issue := range issues {
		if issue.Level == "error" {
			errors = append(errors, issue)
		}
	}
	return errors
}

func proxyGroupNode(item configProxyGroup) *yaml.Node {
	node := &yaml.Node{Kind: yaml.MappingNode}
	appendKV(node, "name", scalar(item.Name))
	appendKV(node, "type", scalar(item.Type))
	if len(item.Proxies) > 0 {
		appendKV(node, "proxies", sequence(item.Proxies))
	}
	if len(item.Use) > 0 {
		appendKV(node, "use", sequence(item.Use))
	}
	appendOptionalKV(node, "url", item.URL)
	appendOptionalKV(node, "interval", item.Interval)
	appendOptionalKV(node, "filter", item.Filter)
	return node
}

func ruleProviderNode(item configRuleProvider) *yaml.Node {
	node := &yaml.Node{Kind: yaml.MappingNode}
	appendOptionalKV(node, "type", fallback(item.Type, "http"))
	appendOptionalKV(node, "behavior", fallback(item.Behavior, "domain"))
	appendOptionalKV(node, "url", item.URL)
	appendOptionalKV(node, "path", item.Path)
	appendOptionalKV(node, "interval", item.Interval)
	return node
}

func ensureSequence(root *yaml.Node, key string) *yaml.Node {
	if node := mappingValue(root, key); node != nil {
		if node.Kind != yaml.SequenceNode {
			node.Kind = yaml.SequenceNode
			node.Content = nil
		}
		return node
	}
	value := &yaml.Node{Kind: yaml.SequenceNode}
	root.Content = append(root.Content, scalar(key), value)
	return value
}

func upsertNamedSequenceItem(seq *yaml.Node, name string, value *yaml.Node) {
	for i, node := range seq.Content {
		if childScalar(node, "name") == name {
			seq.Content[i] = value
			return
		}
	}
	seq.Content = append(seq.Content, value)
}

func removeNamedSequenceItem(seq *yaml.Node, name string) {
	if seq == nil || seq.Kind != yaml.SequenceNode {
		return
	}
	for i, node := range seq.Content {
		if childScalar(node, "name") == name {
			seq.Content = append(seq.Content[:i], seq.Content[i+1:]...)
			return
		}
	}
}

func moveNamedSequenceItem(seq *yaml.Node, name string, direction string) bool {
	if seq == nil || seq.Kind != yaml.SequenceNode {
		return false
	}
	for i, node := range seq.Content {
		if childScalar(node, "name") == name {
			return moveSequenceItem(seq, i, direction)
		}
	}
	return false
}

func moveSequenceItem(seq *yaml.Node, index int, direction string) bool {
	if seq == nil || seq.Kind != yaml.SequenceNode || index < 0 || index >= len(seq.Content) {
		return false
	}
	target := index
	switch direction {
	case "up":
		target = index - 1
	case "down":
		target = index + 1
	default:
		return false
	}
	if target < 0 || target >= len(seq.Content) {
		return false
	}
	seq.Content[index], seq.Content[target] = seq.Content[target], seq.Content[index]
	return true
}

func appendKV(node *yaml.Node, key string, value *yaml.Node) {
	node.Content = append(node.Content, scalar(key), value)
}

func appendOptionalKV(node *yaml.Node, key string, value string) {
	if strings.TrimSpace(value) == "" {
		return
	}
	appendKV(node, key, scalar(value))
}

func sequence(items []string) *yaml.Node {
	node := &yaml.Node{Kind: yaml.SequenceNode}
	for _, item := range items {
		if strings.TrimSpace(item) != "" {
			node.Content = append(node.Content, scalar(strings.TrimSpace(item)))
		}
	}
	return node
}

func childScalars(root *yaml.Node, key string) []string {
	node := mappingValue(root, key)
	if node == nil || node.Kind != yaml.SequenceNode {
		return nil
	}
	items := make([]string, 0, len(node.Content))
	for _, child := range node.Content {
		items = append(items, child.Value)
	}
	return items
}

func parseIndex(value string) (int, bool) {
	index, err := strconv.Atoi(value)
	return index, err == nil
}

func fallback(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
