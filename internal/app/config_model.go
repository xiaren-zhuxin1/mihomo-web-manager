package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

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

type tunConfig struct {
	Enable              bool     `json:"enable"`
	Stack               string   `json:"stack,omitempty"`
	Device              string   `json:"device,omitempty"`
	DNSHijack           []string `json:"dnsHijack,omitempty"`
	AutoRoute           *bool    `json:"autoRoute,omitempty"`
	AutoDetectInterface *bool    `json:"autoDetectInterface,omitempty"`
}

type tunBlocker struct {
	Code        string `json:"code"`
	Severity    string `json:"severity"`
	Title       string `json:"title"`
	Description string `json:"description"`
	FixCommand  string `json:"fixCommand,omitempty"`
	FixUrl      string `json:"fixUrl,omitempty"`
}

type tunDiagnostics struct {
	Config             tunConfig    `json:"config"`
	Runtime            tunConfig    `json:"runtime"`
	RuntimeAvailable   bool         `json:"runtimeAvailable"`
	ServiceMode        string       `json:"serviceMode"`
	HostTunExists      bool         `json:"hostTunExists"`
	DockerDeviceMapped bool         `json:"dockerDeviceMapped"`
	DockerNetAdmin     bool         `json:"dockerNetAdmin"`
	DockerPrivileged   bool         `json:"dockerPrivileged"`
	Ready              bool         `json:"ready"`
	Notes              []string     `json:"notes"`
	Blockers           []tunBlocker `json:"blockers"`
	Suggestions        []string     `json:"suggestions"`
	CanAutoFix         bool         `json:"canAutoFix"`
	LastError          string       `json:"lastError,omitempty"`
	MihomoLogSnippet   string       `json:"mihomoLogSnippet,omitempty"`
}

var configNamePattern = regexp.MustCompile(`^[\p{L}\p{N} _.\-()!@]+$`)

func (s *Server) handleConfigModel(w http.ResponseWriter, r *http.Request) {
	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"proxyGroups":    readProxyGroups(root),
		"proxyProviders": readMappingKeys(root, "proxy-providers"),
		"rules":          readRuleStrings(root),
		"ruleProviders":  readRuleProviders(root),
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

func (s *Server) handleTunDiagnostics(w http.ResponseWriter, r *http.Request) {
	diagnostics, err := s.buildTunDiagnostics()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, diagnostics)
}

func (s *Server) handleTunPreCheck(w http.ResponseWriter, r *http.Request) {
	diagnostics, err := s.buildTunDiagnostics()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	criticalBlockers := []tunBlocker{}
	for _, b := range diagnostics.Blockers {
		if b.Severity == "error" {
			criticalBlockers = append(criticalBlockers, b)
		}
	}

	environmentReady := false
	if s.cfg.ServiceMode == "docker" {
		environmentReady = diagnostics.HostTunExists && (diagnostics.DockerPrivileged || (diagnostics.DockerDeviceMapped && diagnostics.DockerNetAdmin))
	} else {
		environmentReady = diagnostics.HostTunExists
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"canEnable":        len(criticalBlockers) == 0,
		"blockers":         criticalBlockers,
		"suggestions":      diagnostics.Suggestions,
		"environmentReady": environmentReady,
		"diagnostics":      diagnostics,
	})
}

func (s *Server) handleTunAutoFix(w http.ResponseWriter, r *http.Request) {
	diagnostics, err := s.buildTunDiagnostics()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var fixes []string
	var errors []string
	var fixActions []map[string]string

	for _, blocker := range diagnostics.Blockers {
		switch blocker.Code {
		case "TUN_RUNTIME_INACTIVE":
			var restartErr error
			if s.cfg.ServiceMode == "docker" {
				_, restartErr = runDocker("restart", s.cfg.ContainerName)
			} else {
				_, restartErr = runSystemctl("restart", "mihomo")
			}
			if restartErr == nil {
				fixes = append(fixes, "已重启 "+s.cfg.ServiceMode+" 服务")
				fixActions = append(fixActions, map[string]string{
					"action":  "restart",
					"success": "true",
				})
				time.Sleep(2 * time.Second)
			} else {
				errors = append(errors, "重启服务失败: "+restartErr.Error())
				fixActions = append(fixActions, map[string]string{
					"action":  "restart",
					"success": "false",
					"error":   restartErr.Error(),
				})
			}
		default:
			fixActions = append(fixActions, map[string]string{
				"action":  "manual",
				"code":    blocker.Code,
				"message": "此问题需要手动处理",
			})
		}
	}

	newDiagnostics, _ := s.buildTunDiagnostics()

	writeJSON(w, http.StatusOK, map[string]any{
		"fixes":        fixes,
		"errors":       errors,
		"fixActions":   fixActions,
		"diagnostics":  newDiagnostics,
	})
}

func (s *Server) handlePatchTunConfig(w http.ResponseWriter, r *http.Request) {
	var payload tunConfig
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	if payload.Enable {
		diagnostics, diagErr := s.buildTunDiagnostics()
		if diagErr != nil {
			writeError(w, http.StatusInternalServerError, "无法检查 TUN 环境: "+diagErr.Error())
			return
		}

		criticalBlockers := []tunBlocker{}
		for _, b := range diagnostics.Blockers {
			if b.Severity == "error" {
				criticalBlockers = append(criticalBlockers, b)
			}
		}

		if len(criticalBlockers) > 0 {
			writeJSON(w, http.StatusPreconditionFailed, map[string]any{
				"error":       "TUN 环境不满足要求，无法启用",
				"blockers":    criticalBlockers,
				"diagnostics": diagnostics,
				"manualFix":   "请根据下方提示手动修复环境问题后重试",
			})
			return
		}
	}

	root, err := s.readConfigYAML()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	applyTunConfig(root, payload)
	if err := s.writeConfigYAML(root); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	status, body, reloadErr := s.reloadMihomoWithRetry(2, 2*time.Second, true)

	diagnostics, diagErr := s.buildTunDiagnostics()
	if diagErr != nil {
		writeJSON(w, http.StatusAccepted, map[string]any{
			"saved":           true,
			"reloadStatus":    status,
			"reloadBody":      body,
			"reloadError":     errorString(reloadErr),
			"diagnostics":     nil,
			"diagnosticError": diagErr.Error(),
		})
		return
	}
	if reloadErr != nil || status >= 300 {
		diagnostics.LastError = body
		if logSnippet, err := s.getMihomoLogSnippet(30); err == nil && logSnippet != "" {
			diagnostics.MihomoLogSnippet = logSnippet
		}
		writeJSON(w, http.StatusAccepted, map[string]any{
			"saved":        true,
			"reloadStatus": status,
			"reloadBody":   body,
			"reloadError":  errorString(reloadErr),
			"diagnostics":  diagnostics,
			"help":         "请检查 mihomo 日志以获取详细错误信息",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"saved": true, "diagnostics": diagnostics})
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
	_, _, _ = s.reloadMihomo()
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
	_, _, _ = s.reloadMihomo()
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
	_, _, _ = s.reloadMihomo()
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
	_, _, _ = s.reloadMihomo()
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
	_, _, _ = s.reloadMihomo()
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
	_, _, _ = s.reloadMihomo()
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
	_, _, _ = s.reloadMihomo()
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
	_, _, _ = s.reloadMihomo()
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
	_, _, _ = s.reloadMihomo()
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

func (s *Server) buildTunDiagnostics() (tunDiagnostics, error) {
	root, err := s.readConfigYAML()
	if err != nil {
		return tunDiagnostics{}, err
	}
	diagnostics := tunDiagnostics{
		Config:      readTunConfig(mappingValue(root, "tun")),
		ServiceMode: s.cfg.ServiceMode,
		Notes:       []string{},
		Blockers:    []tunBlocker{},
		Suggestions: []string{},
	}

	if _, err := os.Stat("/dev/net/tun"); err == nil {
		diagnostics.HostTunExists = true
	} else if os.IsNotExist(err) {
		diagnostics.Blockers = append(diagnostics.Blockers, tunBlocker{
			Code:        "TUN_DEVICE_MISSING",
			Severity:    "error",
			Title:       "/dev/net/tun 设备不存在",
			Description: "主机缺少 TUN 设备节点，无法创建 TUN 接口。这通常是因为 tun 内核模块未加载。",
			FixCommand:  "sudo modprobe tun && sudo mkdir -p /dev/net && sudo mknod /dev/net/tun c 10 200 && sudo chmod 666 /dev/net/tun",
			FixUrl:      "https://github.com/xiaren-zhuxin1/mihomo-webui/blob/main/docs/TUN.md#设备不存在",
		})
	} else {
		diagnostics.Notes = append(diagnostics.Notes, "host /dev/net/tun check failed: "+err.Error())
		diagnostics.Blockers = append(diagnostics.Blockers, tunBlocker{
			Code:        "TUN_DEVICE_CHECK_FAILED",
			Severity:    "error",
			Title:       "无法检查 /dev/net/tun",
			Description: "检查 TUN 设备时发生错误: " + err.Error(),
		})
	}

	if runtimeConfig, err := s.readRuntimeTunConfigWithRetry(3); err == nil {
		diagnostics.Runtime = runtimeConfig
		diagnostics.RuntimeAvailable = true
	} else {
		diagnostics.Notes = append(diagnostics.Notes, "runtime config read failed: "+err.Error())
		diagnostics.Blockers = append(diagnostics.Blockers, tunBlocker{
			Code:        "RUNTIME_CONFIG_UNAVAILABLE",
			Severity:    "warning",
			Title:       "无法读取 mihomo 运行时配置",
			Description: "mihomo API 不可用或返回错误，请确认 mihomo 服务正在运行。错误: " + err.Error(),
			FixCommand:  func() string { if s.cfg.ServiceMode == "docker" { return "docker logs " + s.cfg.ContainerName } else { return "sudo journalctl -u mihomo -n 50" } }(),
		})
	}

	environmentReady := false
	if s.cfg.ServiceMode == "docker" {
		mapped, netAdmin, privileged, err := inspectDockerTun(s.cfg.ContainerName)
		diagnostics.DockerDeviceMapped = mapped
		diagnostics.DockerNetAdmin = netAdmin
		diagnostics.DockerPrivileged = privileged
		if err != nil {
			diagnostics.Notes = append(diagnostics.Notes, "docker inspect failed: "+err.Error())
			diagnostics.Blockers = append(diagnostics.Blockers, tunBlocker{
				Code:        "DOCKER_INSPECT_FAILED",
				Severity:    "error",
				Title:       "无法检查容器配置",
				Description: "Docker inspect 命令执行失败: " + err.Error(),
			})
		}
		if !mapped && !privileged {
			diagnostics.Blockers = append(diagnostics.Blockers, tunBlocker{
				Code:        "DOCKER_DEVICE_NOT_MAPPED",
				Severity:    "error",
				Title:       "容器未映射 /dev/net/tun",
				Description: "Docker 容器需要映射主机的 TUN 设备才能创建虚拟网络接口。",
				FixCommand:  "docker run --device /dev/net/tun ...",
				FixUrl:      "https://github.com/xiaren-zhuxin1/mihomo-webui/blob/main/docs/TUN.md#docker-设备映射",
			})
		}
		if !netAdmin && !privileged {
			diagnostics.Blockers = append(diagnostics.Blockers, tunBlocker{
				Code:        "DOCKER_NET_ADMIN_MISSING",
				Severity:    "error",
				Title:       "容器缺少 NET_ADMIN 权限",
				Description: "Docker 容器需要 NET_ADMIN capability 来创建和管理网络接口。",
				FixCommand:  "docker run --cap-add NET_ADMIN ...",
				FixUrl:      "https://github.com/xiaren-zhuxin1/mihomo-webui/blob/main/docs/TUN.md#docker-权限配置",
			})
		}
		environmentReady = diagnostics.HostTunExists && (diagnostics.DockerPrivileged || (diagnostics.DockerDeviceMapped && diagnostics.DockerNetAdmin))
		diagnostics.CanAutoFix = environmentReady
	} else {
		if !diagnostics.HostTunExists {
			diagnostics.Notes = append(diagnostics.Notes, "Host is missing /dev/net/tun.")
		}
		environmentReady = diagnostics.HostTunExists
		diagnostics.CanAutoFix = diagnostics.HostTunExists
	}

	if !diagnostics.Config.Enable {
		diagnostics.Suggestions = append(diagnostics.Suggestions, "配置文件中 TUN 未启用，点击开关即可启用")
	}

	if diagnostics.Config.Enable && diagnostics.RuntimeAvailable && !diagnostics.Runtime.Enable {
		diagnostics.Blockers = append(diagnostics.Blockers, tunBlocker{
			Code:        "TUN_RUNTIME_INACTIVE",
			Severity:    "warning",
			Title:       "TUN 配置已启用但运行时未激活",
			Description: "配置文件中 TUN 已启用，但 mihomo 运行时未激活 TUN。可能是启动失败或配置冲突。",
			FixUrl:      "https://github.com/xiaren-zhuxin1/mihomo-webui/blob/main/docs/TUN.md#运行时未激活",
		})
		if logSnippet, err := s.getMihomoLogSnippet(30); err == nil && logSnippet != "" {
			diagnostics.MihomoLogSnippet = logSnippet
		}
	}

	criticalBlockers := 0
	for _, b := range diagnostics.Blockers {
		if b.Severity == "error" {
			criticalBlockers++
		}
	}
	diagnostics.Ready = criticalBlockers == 0 && diagnostics.Config.Enable && diagnostics.RuntimeAvailable && diagnostics.Runtime.Enable
	return diagnostics, nil
}

func (s *Server) readRuntimeTunConfig() (tunConfig, error) {
	status, body, err := s.forwardMihomo("GET", "/configs", nil)
	if err != nil {
		return tunConfig{}, err
	}
	if status >= 300 {
		return tunConfig{}, fmt.Errorf("mihomo returned status %d", status)
	}
	var payload struct {
		Tun struct {
			Enable              bool     `json:"enable"`
			Stack               string   `json:"stack"`
			Device              string   `json:"device"`
			DNSHijack           []string `json:"dns-hijack"`
			AutoRoute           bool     `json:"auto-route"`
			AutoDetectInterface bool     `json:"auto-detect-interface"`
		} `json:"tun"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return tunConfig{}, err
	}
	return tunConfig{
		Enable:              payload.Tun.Enable,
		Stack:               payload.Tun.Stack,
		Device:              payload.Tun.Device,
		DNSHijack:           payload.Tun.DNSHijack,
		AutoRoute:           &payload.Tun.AutoRoute,
		AutoDetectInterface: &payload.Tun.AutoDetectInterface,
	}, nil
}

func (s *Server) readRuntimeTunConfigWithRetry(maxRetries int) (tunConfig, error) {
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		config, err := s.readRuntimeTunConfig()
		if err == nil {
			return config, nil
		}
		lastErr = err
		if i < maxRetries-1 {
			time.Sleep(time.Duration(i+1) * time.Second)
		}
	}
	return tunConfig{}, lastErr
}

func (s *Server) getMihomoLogSnippet(lines int) (string, error) {
	if s.cfg.ServiceMode == "docker" {
		out, err := runDocker("logs", "--tail", fmt.Sprintf("%d", lines), s.cfg.ContainerName)
		if err != nil {
			return "", err
		}
		return out, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "journalctl", "-u", "mihomo", "-n", fmt.Sprintf("%d", lines), "--no-pager")
	var output bytes.Buffer
	cmd.Stdout = &output
	if err := cmd.Run(); err != nil {
		return "", err
	}
	return output.String(), nil
}

func (s *Server) waitForMihomoReady(timeout time.Duration) bool {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return false
		case <-ticker.C:
			status, _, _ := s.forwardMihomo("GET", "/configs", nil)
			if status >= 200 && status < 300 {
				return true
			}
		}
	}
}

func (s *Server) reloadMihomoWithRetry(maxRetries int, retryDelay time.Duration, fallbackRestart bool) (int, string, error) {
	var lastErr error
	var lastStatus int
	var lastBody string

	for i := 0; i <= maxRetries; i++ {
		status, body, err := s.reloadMihomo()
		lastStatus = status
		lastBody = body
		lastErr = err

		if err == nil && status < 300 {
			return status, body, nil
		}

		if strings.Contains(body, "device or resource busy") || strings.Contains(body, "address already in use") {
			if fallbackRestart {
				var restartErr error
				if s.cfg.ServiceMode == "docker" {
					_, restartErr = runDocker("restart", s.cfg.ContainerName)
				} else {
					_, restartErr = runSystemctl("restart", "mihomo")
				}
				if restartErr == nil {
					time.Sleep(2 * time.Second)
					if s.waitForMihomoReady(10 * time.Second) {
						return 200, "restarted successfully", nil
					}
				}
			}
		}

		if i < maxRetries {
			time.Sleep(retryDelay)
		}
	}

	return lastStatus, lastBody, lastErr
}

func readTunConfig(node *yaml.Node) tunConfig {
	if node == nil || node.Kind != yaml.MappingNode {
		return tunConfig{}
	}
	return tunConfig{
		Enable:              childBool(node, "enable"),
		Stack:               fallback(childScalar(node, "stack"), "system"),
		Device:              childScalar(node, "device"),
		DNSHijack:           childScalars(node, "dns-hijack"),
		AutoRoute:           optionalChildBool(node, "auto-route"),
		AutoDetectInterface: optionalChildBool(node, "auto-detect-interface"),
	}
}

func applyTunConfig(root *yaml.Node, patch tunConfig) {
	tun := ensureMapping(root, "tun")
	existing := readTunConfig(tun)
	patch = withTunDefaults(patch, existing)
	setMappingValue(tun, "enable", boolScalar(patch.Enable))
	setMappingValue(tun, "stack", scalar(patch.Stack))
	if strings.TrimSpace(patch.Device) != "" {
		setMappingValue(tun, "device", scalar(patch.Device))
	} else {
		removeMappingKey(tun, "device")
	}
	setMappingValue(tun, "dns-hijack", sequence(patch.DNSHijack))
	setMappingValue(tun, "auto-route", boolScalar(*patch.AutoRoute))
	setMappingValue(tun, "auto-detect-interface", boolScalar(*patch.AutoDetectInterface))
}

func withTunDefaults(patch tunConfig, existing tunConfig) tunConfig {
	patch.Stack = strings.TrimSpace(patch.Stack)
	if patch.Stack == "" {
		patch.Stack = strings.TrimSpace(existing.Stack)
	}
	if patch.Stack == "" {
		patch.Stack = "system"
	}
	patch.Device = strings.TrimSpace(patch.Device)
	if patch.Device == "" {
		patch.Device = strings.TrimSpace(existing.Device)
	}
	if len(patch.DNSHijack) == 0 {
		patch.DNSHijack = existing.DNSHijack
	}
	if len(patch.DNSHijack) == 0 {
		patch.DNSHijack = []string{"0.0.0.0:53"}
	}
	if patch.AutoRoute == nil {
		patch.AutoRoute = existing.AutoRoute
	}
	if patch.AutoRoute == nil {
		value := true
		patch.AutoRoute = &value
	}
	if patch.AutoDetectInterface == nil {
		patch.AutoDetectInterface = existing.AutoDetectInterface
	}
	if patch.AutoDetectInterface == nil {
		value := true
		patch.AutoDetectInterface = &value
	}
	return patch
}

func inspectDockerTun(container string) (deviceMapped bool, netAdmin bool, privileged bool, err error) {
	out, err := runDocker("inspect", container)
	if err != nil {
		return false, false, false, err
	}
	var payload []struct {
		HostConfig struct {
			Privileged bool     `json:"Privileged"`
			CapAdd     []string `json:"CapAdd"`
			Devices    []struct {
				PathOnHost        string `json:"PathOnHost"`
				PathInContainer   string `json:"PathInContainer"`
				CgroupPermissions string `json:"CgroupPermissions"`
			} `json:"Devices"`
		} `json:"HostConfig"`
	}
	if err := json.Unmarshal([]byte(out), &payload); err != nil {
		return false, false, false, err
	}
	if len(payload) == 0 {
		return false, false, false, fmt.Errorf("container not found")
	}
	hostConfig := payload[0].HostConfig
	privileged = hostConfig.Privileged
	for _, cap := range hostConfig.CapAdd {
		normalized := strings.TrimPrefix(strings.ToUpper(strings.TrimSpace(cap)), "CAP_")
		if normalized == "NET_ADMIN" {
			netAdmin = true
			break
		}
	}
	for _, device := range hostConfig.Devices {
		if device.PathOnHost == "/dev/net/tun" || device.PathInContainer == "/dev/net/tun" {
			deviceMapped = true
			break
		}
	}
	return deviceMapped, netAdmin, privileged, nil
}

func setMappingValue(root *yaml.Node, key string, value *yaml.Node) {
	if root.Kind != yaml.MappingNode {
		root.Kind = yaml.MappingNode
		root.Content = nil
	}
	for i := 0; i+1 < len(root.Content); i += 2 {
		if root.Content[i].Value == key {
			root.Content[i+1] = value
			return
		}
	}
	root.Content = append(root.Content, scalar(key), value)
}

func boolScalar(value bool) *yaml.Node {
	if value {
		return &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!bool", Value: "true"}
	}
	return &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!bool", Value: "false"}
}

func childBool(root *yaml.Node, key string) bool {
	node := mappingValue(root, key)
	if node == nil {
		return false
	}
	return strings.EqualFold(node.Value, "true")
}

func optionalChildBool(root *yaml.Node, key string) *bool {
	node := mappingValue(root, key)
	if node == nil {
		return nil
	}
	value := strings.EqualFold(node.Value, "true")
	return &value
}
