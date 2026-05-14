package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

type geoCacheEntry struct {
	info      *GeoInfo
	expiresAt time.Time
}

type Server struct {
	cfg          Config
	mihomo       *MihomoClient
	configStore  *configStore
	guardian     *Guardian
	subRecovery  *SubRecoveryState
	nodeFailover *NodeFailover
	geoCache     sync.Map
	geoMu        sync.Mutex
	geoCachePath string
}

func NewServer(cfg Config) *Server {
	mihomo := NewMihomoClient(cfg.MihomoController, cfg.MihomoSecret)
	store := newConfigStore(cfg.MihomoConfigPath, cfg.BackupDir)

	s := &Server{
		cfg:          cfg,
		mihomo:       mihomo,
		configStore:  store,
		geoCachePath: filepath.Join(filepath.Dir(cfg.MihomoConfigPath), "geo-cache.json"),
	}

	s.guardian = NewGuardian(s)
	s.subRecovery = NewSubRecoveryState(s)
	s.nodeFailover = NewNodeFailover(s)

	s.loadGeoCache()
	s.guardian.LoadPersistedState()

	return s
}

func (s *Server) StartBackground() {
	s.guardian.Start()
	s.subRecovery.StartAutoUpdate()
	s.nodeFailover.Start()
}

func (s *Server) StopBackground() {
	s.guardian.Stop()
	s.guardian.PersistState()
	s.subRecovery.StopAutoUpdate()
	s.nodeFailover.Stop()
}

func (s *Server) loadGeoCache() {
	data, err := os.ReadFile(s.geoCachePath)
	if err != nil {
		return
	}
	var entries map[string]struct {
		Info      *GeoInfo `json:"info"`
		ExpiresAt string   `json:"expiresAt"`
	}
	if err := json.Unmarshal(data, &entries); err != nil {
		return
	}
	for name, entry := range entries {
		expiresAt, err := time.Parse(time.RFC3339, entry.ExpiresAt)
		if err != nil || time.Now().After(expiresAt) {
			continue
		}
		s.geoCache.Store(name, &geoCacheEntry{
			info:      entry.Info,
			expiresAt: expiresAt,
		})
	}
}

func (s *Server) saveGeoCache() {
	s.geoMu.Lock()
	defer s.geoMu.Unlock()

	entries := make(map[string]struct {
		Info      *GeoInfo `json:"info"`
		ExpiresAt string   `json:"expiresAt"`
	})
	s.geoCache.Range(func(key, value any) bool {
		if entry, ok := value.(*geoCacheEntry); ok && time.Now().Before(entry.expiresAt) {
			entries[key.(string)] = struct {
				Info      *GeoInfo `json:"info"`
				ExpiresAt string   `json:"expiresAt"`
			}{
				Info:      entry.info,
				ExpiresAt: entry.expiresAt.Format(time.RFC3339),
			}
		}
		return true
	})

	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return
	}
	os.WriteFile(s.geoCachePath, data, 0644)
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/config", s.auth(s.handleGetConfig))
	mux.HandleFunc("PUT /api/config", s.auth(s.handlePutConfig))
	mux.HandleFunc("PUT /api/config/safe", s.auth(s.handleSafePutConfig))
	mux.HandleFunc("GET /api/config/model", s.auth(s.handleConfigModel))
	mux.HandleFunc("GET /api/config/validate", s.auth(s.handleValidateConfig))
	mux.HandleFunc("POST /api/config/validate", s.auth(s.handleValidateConfig))
	mux.HandleFunc("GET /api/config/health", s.auth(s.handleConfigHealthCheck))
	mux.HandleFunc("POST /api/config/autorepair", s.auth(s.handleAutoRepairConfig))
	mux.HandleFunc("GET /api/config/tun", s.auth(s.handleTunDiagnostics))
	mux.HandleFunc("GET /api/config/tun/precheck", s.auth(s.handleTunPreCheck))
	mux.HandleFunc("POST /api/config/tun/autofix", s.auth(s.handleTunAutoFix))
	mux.HandleFunc("PATCH /api/config/tun", s.auth(s.handlePatchTunConfig))
	mux.HandleFunc("PUT /api/config/proxy-groups/{name}", s.auth(s.handleUpsertProxyGroup))
	mux.HandleFunc("POST /api/config/proxy-groups/{name}/move", s.auth(s.handleMoveProxyGroup))
	mux.HandleFunc("DELETE /api/config/proxy-groups/{name}", s.auth(s.handleDeleteProxyGroup))
	mux.HandleFunc("POST /api/config/rules", s.auth(s.handleAddConfigRule))
	mux.HandleFunc("PUT /api/config/rules/{index}", s.auth(s.handleUpdateConfigRule))
	mux.HandleFunc("POST /api/config/rules/{index}/move", s.auth(s.handleMoveConfigRule))
	mux.HandleFunc("DELETE /api/config/rules/{index}", s.auth(s.handleDeleteConfigRule))
	mux.HandleFunc("PUT /api/config/rule-providers/{name}", s.auth(s.handleUpsertRuleProvider))
	mux.HandleFunc("DELETE /api/config/rule-providers/{name}", s.auth(s.handleDeleteRuleProvider))
	mux.HandleFunc("POST /api/config/backup", s.auth(s.handleBackupConfig))
	mux.HandleFunc("GET /api/config/backups", s.auth(s.handleListConfigBackups))
	mux.HandleFunc("GET /api/config/backups/{name}", s.auth(s.handleGetConfigBackup))
	mux.HandleFunc("POST /api/config/backups/{name}/restore", s.auth(s.handleRestoreConfigBackup))
	mux.HandleFunc("GET /api/config/providers/diagnostics", s.auth(s.handleProviderDiagnostics))
	mux.HandleFunc("POST /api/config/providers/autofix", s.auth(s.handleProviderAutofix))
	mux.HandleFunc("GET /api/subscriptions", s.auth(s.handleListSubscriptions))
	mux.HandleFunc("POST /api/subscriptions", s.auth(s.handleCreateSubscription))
	mux.HandleFunc("PATCH /api/subscriptions/{id}", s.auth(s.handleEditSubscription))
	mux.HandleFunc("POST /api/subscriptions/{id}/update", s.auth(s.handleUpdateSubscription))
	mux.HandleFunc("POST /api/subscriptions/{id}/retry", s.auth(s.handleSubscriptionRetryUpdate))
	mux.HandleFunc("POST /api/subscriptions/connectivity", s.auth(s.handleSubscriptionConnectivity))
	mux.HandleFunc("GET /api/subscriptions/recovery", s.auth(s.handleSubRecoveryStatus))
	mux.HandleFunc("PUT /api/subscriptions/recovery", s.auth(s.handleSubRecoveryConfig))
	mux.HandleFunc("DELETE /api/subscriptions/{id}", s.auth(s.handleDeleteSubscription))
	mux.HandleFunc("GET /api/service/status", s.auth(s.handleServiceStatus))
	mux.HandleFunc("POST /api/service/{action}", s.auth(s.handleServiceAction))
	mux.HandleFunc("GET /api/proxy/geo/cache", s.auth(s.handleGeoCache))
	mux.HandleFunc("GET /api/proxy/geo/batch", s.auth(s.handleBatchProxyGeo))
	mux.HandleFunc("GET /api/proxy/geo/diagnostics", s.auth(s.handleGeoDiagnostics))
	mux.HandleFunc("POST /api/proxy/geo/auto-assign", s.auth(s.handleAutoAssignGroups))
	mux.HandleFunc("GET /api/proxy/{name}/geo", s.auth(s.handleProxyGeo))
	mux.HandleFunc("GET /api/recovery/status", s.auth(s.guardian.HandleGetStatus))
	mux.HandleFunc("PUT /api/recovery/enabled", s.auth(s.guardian.HandleSetEnabled))
	mux.HandleFunc("POST /api/recovery/trigger", s.auth(s.guardian.HandleTriggerRecovery))
	mux.HandleFunc("GET /api/recovery/events", s.auth(s.guardian.HandleGetEvents))
	mux.HandleFunc("GET /api/nodes/failover", s.auth(s.handleNodeFailoverStatus))
	mux.HandleFunc("PUT /api/nodes/failover", s.auth(s.handleNodeFailoverConfig))
	mux.HandleFunc("GET /api/nodes/health", s.auth(s.handleNodeHealth))
	mux.HandleFunc("POST /api/nodes/reset-skip", s.auth(s.handleNodeResetSkip))
	mux.HandleFunc("POST /api/nodes/auto-switch", s.auth(s.handleNodeAutoSwitch))
	mux.HandleFunc("POST /api/nodes/batch-test", s.auth(s.handleBatchNodeTest))
	mux.HandleFunc("/api/mihomo/", s.auth(s.handleMihomoProxy))

	fileServer := http.FileServer(http.Dir(s.cfg.WebDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(s.cfg.WebDir, filepath.Clean(r.URL.Path))
		if stat, err := os.Stat(path); err == nil && !stat.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(s.cfg.WebDir, "index.html"))
	})

	return withCORS(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	guardianStatus := s.guardian.GetStatus()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                 true,
		"version":            Version,
		"buildDate":          BuildDate,
		"mihomoController":   s.cfg.MihomoController,
		"mihomoConfigPath":   s.cfg.MihomoConfigPath,
		"managerTokenActive": s.cfg.ManagerToken != "",
		"serviceMode":        s.cfg.ServiceMode,
		"os":                 runtime.GOOS,
		"mihomoAlive":        guardianStatus.MihomoAlive,
		"recoveryEnabled":    guardianStatus.Enabled,
	})
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	body, err := os.ReadFile(s.cfg.MihomoConfigPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"content": string(body)})
}

func (s *Server) handlePutConfig(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Content string `json:"content"`
		Reload  bool   `json:"reload"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if strings.TrimSpace(payload.Content) == "" {
		writeError(w, http.StatusBadRequest, "config content is empty")
		return
	}
	if _, err := s.backupConfig(); err != nil && !errors.Is(err, os.ErrNotExist) {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("backup failed: %v", err))
		return
	}
	if err := os.WriteFile(s.cfg.MihomoConfigPath, []byte(payload.Content), 0o640); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if payload.Reload {
		status, body, err := s.mihomo.Reload()
		if err != nil || status >= 300 {
			writeJSON(w, http.StatusAccepted, map[string]any{
				"saved":        true,
				"reloadStatus": status,
				"reloadBody":   body,
				"reloadError":  errorString(err),
			})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"saved": true})
}

func (s *Server) handleBackupConfig(w http.ResponseWriter, r *http.Request) {
	path, err := s.backupConfig()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": path})
}

func (s *Server) handleListConfigBackups(w http.ResponseWriter, r *http.Request) {
	backups, err := s.configStore.ListBackups()
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeJSON(w, http.StatusOK, map[string]any{"backups": []ConfigBackupInfo{}})
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"backups": backups})
}

func (s *Server) handleGetConfigBackup(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	content, err := s.configStore.ReadBackup(name)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"content": content})
}

func (s *Server) handleRestoreConfigBackup(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if err := s.configStore.RestoreBackup(name); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	status, responseBody, err := s.mihomo.Reload()
	if err != nil || status >= 300 {
		writeJSON(w, http.StatusAccepted, map[string]any{
			"restored":     true,
			"reloadStatus": status,
			"reloadBody":   responseBody,
			"reloadError":  errorString(err),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"restored": true})
}

func (s *Server) backupConfig() (string, error) {
	return s.configStore.Backup()
}

func (s *Server) readConfigYAML() (*yaml.Node, error) {
	return s.configStore.Read()
}

func (s *Server) writeConfigYAML(root *yaml.Node) error {
	return s.configStore.Write(root)
}

func (s *Server) reloadMihomo() (int, string, error) {
	status, body, err := s.mihomo.Reload()
	if err != nil {
		return status, body, err
	}
	if status >= 300 {
		return status, body, fmt.Errorf("mihomo reload failed: %s", body)
	}
	return status, body, nil
}

func (s *Server) forwardMihomo(method string, path string, body io.Reader) (int, string, error) {
	return s.mihomo.Do(method, path, body)
}
