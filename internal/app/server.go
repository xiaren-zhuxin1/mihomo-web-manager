package app

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

type geoCacheEntry struct {
	info      *GeoInfo
	expiresAt time.Time
}

type Server struct {
	cfg      Config
	geoCache sync.Map
	geoMu    sync.Mutex
}

func NewServer(cfg Config) *Server {
	return &Server{cfg: cfg}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/config", s.auth(s.handleGetConfig))
	mux.HandleFunc("PUT /api/config", s.auth(s.handlePutConfig))
	mux.HandleFunc("GET /api/config/model", s.auth(s.handleConfigModel))
	mux.HandleFunc("GET /api/config/validate", s.auth(s.handleValidateConfigModel))
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
	mux.HandleFunc("GET /api/subscriptions", s.auth(s.handleListSubscriptions))
	mux.HandleFunc("POST /api/subscriptions", s.auth(s.handleCreateSubscription))
	mux.HandleFunc("PATCH /api/subscriptions/{id}", s.auth(s.handleEditSubscription))
	mux.HandleFunc("POST /api/subscriptions/{id}/update", s.auth(s.handleUpdateSubscription))
	mux.HandleFunc("DELETE /api/subscriptions/{id}", s.auth(s.handleDeleteSubscription))
	mux.HandleFunc("GET /api/service/status", s.auth(s.handleServiceStatus))
	mux.HandleFunc("POST /api/service/{action}", s.auth(s.handleServiceAction))
	mux.HandleFunc("GET /api/proxy/{name}/geo", s.auth(s.handleProxyGeo))
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

func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.ManagerToken == "" {
			next(w, r)
			return
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token != s.cfg.ManagerToken {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                 true,
		"version":            Version,
		"buildDate":          BuildDate,
		"mihomoController":   s.cfg.MihomoController,
		"mihomoConfigPath":   s.cfg.MihomoConfigPath,
		"managerTokenActive": s.cfg.ManagerToken != "",
		"serviceMode":        s.cfg.ServiceMode,
		"os":                 runtime.GOOS,
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
		status, body, err := s.forwardMihomo("PUT", "/configs?force=true", strings.NewReader(`{}`))
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

type configBackupInfo struct {
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	Size       int64     `json:"size"`
	ModifiedAt time.Time `json:"modifiedAt"`
}

func (s *Server) handleListConfigBackups(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(s.cfg.BackupDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeJSON(w, http.StatusOK, map[string]any{"backups": []configBackupInfo{}})
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	backups := make([]configBackupInfo, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".yaml") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		path := filepath.Join(s.cfg.BackupDir, entry.Name())
		backups = append(backups, configBackupInfo{
			Name:       entry.Name(),
			Path:       path,
			Size:       info.Size(),
			ModifiedAt: info.ModTime(),
		})
	}
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].ModifiedAt.After(backups[j].ModifiedAt)
	})
	writeJSON(w, http.StatusOK, map[string]any{"backups": backups})
}

func (s *Server) handleGetConfigBackup(w http.ResponseWriter, r *http.Request) {
	path, ok := s.configBackupPath(r.PathValue("name"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid backup name")
		return
	}
	body, err := os.ReadFile(path)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"content": string(body)})
}

func (s *Server) handleRestoreConfigBackup(w http.ResponseWriter, r *http.Request) {
	path, ok := s.configBackupPath(r.PathValue("name"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid backup name")
		return
	}
	body, err := os.ReadFile(path)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if _, err := s.backupConfig(); err != nil && !errors.Is(err, os.ErrNotExist) {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("backup failed: %v", err))
		return
	}
	if err := os.WriteFile(s.cfg.MihomoConfigPath, body, 0o640); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	status, responseBody, err := s.forwardMihomo("PUT", "/configs?force=true", strings.NewReader(`{}`))
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

func (s *Server) configBackupPath(name string) (string, bool) {
	if name == "" || name != filepath.Base(name) || !strings.HasSuffix(name, ".yaml") {
		return "", false
	}
	return filepath.Join(s.cfg.BackupDir, name), true
}

func (s *Server) backupConfig() (string, error) {
	body, err := os.ReadFile(s.cfg.MihomoConfigPath)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(s.cfg.BackupDir, 0o750); err != nil {
		return "", err
	}
	name := fmt.Sprintf("config-%s.yaml", time.Now().Format("20060102-150405"))
	path := filepath.Join(s.cfg.BackupDir, name)
	return path, os.WriteFile(path, body, 0o640)
}

func (s *Server) handleMihomoProxy(w http.ResponseWriter, r *http.Request) {
	targetPath := strings.TrimPrefix(r.URL.Path, "/api/mihomo")
	if targetPath == "" {
		targetPath = "/"
	}
	if r.URL.RawQuery != "" {
		targetPath += "?" + r.URL.RawQuery
	}
	if strings.HasPrefix(targetPath, "/traffic") || strings.HasPrefix(targetPath, "/logs") {
		s.streamMihomoSSE(w, r, targetPath)
		return
	}
	status, body, err := s.forwardMihomo(r.Method, targetPath, r.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}

func (s *Server) forwardMihomo(method string, path string, body io.Reader) (int, string, error) {
	controllerURL := s.cfg.MihomoController
	if !strings.HasPrefix(controllerURL, "http://") && !strings.HasPrefix(controllerURL, "https://") {
		controllerURL = "http://" + controllerURL
	}
	url := strings.TrimRight(controllerURL, "/") + path
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return 0, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.cfg.MihomoSecret != "" {
		req.Header.Set("Authorization", "Bearer "+s.cfg.MihomoSecret)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, "", err
	}
	return resp.StatusCode, string(data), nil
}

func (s *Server) streamMihomoSSE(w http.ResponseWriter, r *http.Request, path string) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher, _ := w.(http.Flusher)
	writeSSE(w, "status", "connected")
	if flusher != nil {
		flusher.Flush()
	}

	url := strings.TrimRight(s.cfg.MihomoController, "/") + path
	req, err := http.NewRequestWithContext(r.Context(), r.Method, url, nil)
	if err != nil {
		writeSSE(w, "error", err.Error())
		if flusher != nil {
			flusher.Flush()
		}
		return
	}
	if s.cfg.MihomoSecret != "" {
		req.Header.Set("Authorization", "Bearer "+s.cfg.MihomoSecret)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeSSE(w, "error", err.Error())
		if flusher != nil {
			flusher.Flush()
		}
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		writeSSE(w, "error", fmt.Sprintf("mihomo stream returned %s", resp.Status))
		if flusher != nil {
			flusher.Flush()
		}
		return
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		writeSSE(w, "message", line)
		if flusher != nil {
			flusher.Flush()
		}
	}
	if err := scanner.Err(); err != nil && r.Context().Err() == nil {
		writeSSE(w, "error", err.Error())
		if flusher != nil {
			flusher.Flush()
		}
	}
}

func writeSSE(w io.Writer, event string, data string) {
	if event != "" && event != "message" {
		_, _ = fmt.Fprintf(w, "event: %s\n", event)
	}
	for _, line := range strings.Split(data, "\n") {
		if _, err := fmt.Fprintf(w, "data: %s\n", line); err != nil {
			return
		}
	}
	_, _ = fmt.Fprint(w, "\n")
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
