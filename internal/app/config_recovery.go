package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type ConfigValidationResult struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

func validateYAML(content string) *ConfigValidationResult {
	result := &ConfigValidationResult{Valid: true}

	if strings.TrimSpace(content) == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "配置内容为空")
		return result
	}

	var doc yaml.Node
	if err := yaml.Unmarshal([]byte(content), &doc); err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "YAML 解析失败: "+err.Error())
		return result
	}

	root := doc.Content[0]
	if root == nil || root.Kind != yaml.MappingNode {
		result.Valid = false
		result.Errors = append(result.Errors, "配置根节点必须是映射类型")
		return result
	}

	requiredKeys := []string{"proxy-groups", "proxies"}
	for _, key := range requiredKeys {
		if mappingValue(root, key) == nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("缺少推荐字段: %s", key))
		}
	}

	proxyGroups := mappingValue(root, "proxy-groups")
	if proxyGroups != nil && proxyGroups.Kind == yaml.SequenceNode {
		for i, item := range proxyGroups.Content {
			if item.Kind != yaml.MappingNode {
				result.Errors = append(result.Errors, fmt.Sprintf("proxy-groups[%d] 不是映射类型", i))
				result.Valid = false
				continue
			}
			name := childScalar(item, "name")
			if name == "" {
				result.Errors = append(result.Errors, fmt.Sprintf("proxy-groups[%d] 缺少 name 字段", i))
				result.Valid = false
			}
			pgType := childScalar(item, "type")
			validTypes := map[string]bool{"select": true, "url-test": true, "fallback": true, "load-balance": true, "relay": true}
			if pgType != "" && !validTypes[pgType] {
				result.Errors = append(result.Errors, fmt.Sprintf("proxy-groups[%d] 无效类型: %s", i, pgType))
				result.Valid = false
			}
		}
	}

	port := childScalar(root, "port")
	if port != "" {
		if p := parseIntSafe(port); p > 0 && p < 1024 {
			result.Warnings = append(result.Warnings, fmt.Sprintf("端口 %s 需要特权", port))
		}
	}

	return result
}

func (cs *configStore) SafeWrite(content string, mihomo *MihomoClient) (*ConfigValidationResult, error) {
	validation := validateYAML(content)
	if !validation.Valid {
		return validation, fmt.Errorf("配置校验失败")
	}

	backupName, err := cs.Backup()
	if err != nil {
		return validation, fmt.Errorf("备份失败: %w", err)
	}

	if err := cs.WriteRaw(content); err != nil {
		return validation, fmt.Errorf("写入失败: %w", err)
	}

	status, _, reloadErr := mihomo.Reload()
	if reloadErr != nil || status >= 300 {
		cs.Rollback(backupName)
		return validation, fmt.Errorf("重载失败 (status=%d), 已自动回滚: %v", status, reloadErr)
	}

	return validation, nil
}

func (cs *configStore) SafeWriteNode(root *yaml.Node, mihomo *MihomoClient) (*ConfigValidationResult, error) {
	doc := yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{root}}
	data, err := yaml.Marshal(&doc)
	if err != nil {
		return nil, fmt.Errorf("序列化失败: %w", err)
	}
	return cs.SafeWrite(string(data), mihomo)
}

func (cs *configStore) Rollback(backupPath string) error {
	data, err := os.ReadFile(backupPath)
	if err != nil {
		return fmt.Errorf("读取备份失败: %w", err)
	}
	return os.WriteFile(cs.configPath, data, 0o640)
}

func (cs *configStore) AutoRepair(mihomo *MihomoClient) (*ConfigValidationResult, error) {
	content, err := cs.ReadRaw()
	if err != nil {
		return nil, fmt.Errorf("读取配置失败: %w", err)
	}

	validation := validateYAML(content)
	if validation.Valid {
		return validation, nil
	}

	backups, err := cs.ListBackups()
	if err != nil || len(backups) == 0 {
		return validation, fmt.Errorf("配置损坏且无可用备份")
	}

	for _, backup := range backups {
		backupContent, err := cs.ReadBackup(backup.Name)
		if err != nil {
			continue
		}

		backupValidation := validateYAML(backupContent)
		if !backupValidation.Valid {
			continue
		}

		if err := cs.WriteRaw(backupContent); err != nil {
			continue
		}

		status, _, reloadErr := mihomo.Reload()
		if reloadErr == nil && status < 300 {
			return &ConfigValidationResult{
				Valid:    true,
				Warnings: []string{fmt.Sprintf("已从备份 %s 自动恢复", backup.Name)},
			}, nil
		}

		cs.WriteRaw(content)
	}

	return validation, fmt.Errorf("所有备份均无法恢复")
}

func parseIntSafe(s string) int {
	var n int
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		} else {
			break
		}
	}
	return n
}

func (s *Server) handleValidateConfig(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	result := validateYAML(payload.Content)
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleAutoRepairConfig(w http.ResponseWriter, r *http.Request) {
	result, err := s.configStore.AutoRepair(s.mihomo)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"repaired": false,
			"error":    err.Error(),
			"validation": result,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"repaired":   true,
		"validation": result,
	})
}

func (s *Server) handleSafePutConfig(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Content string `json:"content"`
		Reload  bool   `json:"reload"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	if !payload.Reload {
		if err := s.configStore.WriteRaw(payload.Content); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"saved": true})
		return
	}

	validation, err := s.configStore.SafeWrite(payload.Content, s.mihomo)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"saved":      false,
			"validation": validation,
			"error":      err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"saved":      true,
		"validation": validation,
	})
}

func (s *Server) handleConfigHealthCheck(w http.ResponseWriter, r *http.Request) {
	content, err := s.configStore.ReadRaw()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"healthy":   false,
			"readable":  false,
			"error":     err.Error(),
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	validation := validateYAML(content)
	mihomoAlive := s.guardian.GetStatus().MihomoAlive

	writeJSON(w, http.StatusOK, map[string]any{
		"healthy":      validation.Valid && mihomoAlive,
		"readable":     true,
		"validYAML":    validation.Valid,
		"mihomoAlive":  mihomoAlive,
		"errors":       validation.Errors,
		"warnings":     validation.Warnings,
		"fileSize":     len(content),
		"timestamp":    time.Now().Format(time.RFC3339),
	})
}
