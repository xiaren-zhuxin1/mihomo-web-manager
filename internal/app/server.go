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
	"time"
)

type Server struct {
	cfg Config
}

func NewServer(cfg Config) *Server {
	return &Server{cfg: cfg}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/config", s.auth(s.handleGetConfig))
	mux.HandleFunc("PUT /api/config", s.auth(s.handlePutConfig))
	mux.HandleFunc("POST /api/config/backup", s.auth(s.handleBackupConfig))
	mux.HandleFunc("GET /api/subscriptions", s.auth(s.handleListSubscriptions))
	mux.HandleFunc("POST /api/subscriptions", s.auth(s.handleCreateSubscription))
	mux.HandleFunc("POST /api/subscriptions/{id}/update", s.auth(s.handleUpdateSubscription))
	mux.HandleFunc("DELETE /api/subscriptions/{id}", s.auth(s.handleDeleteSubscription))
	mux.HandleFunc("GET /api/service/status", s.auth(s.handleServiceStatus))
	mux.HandleFunc("POST /api/service/{action}", s.auth(s.handleServiceAction))
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
	url := strings.TrimRight(s.cfg.MihomoController, "/") + path
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
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
