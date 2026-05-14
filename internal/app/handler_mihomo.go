package app

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"strings"
)

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
	status, body, err := s.mihomo.Do(r.Method, targetPath, r.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
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

	req, err := s.mihomo.NewStreamRequest(r.Method, path)
	if err != nil {
		writeSSE(w, "error", err.Error())
		if flusher != nil {
			flusher.Flush()
		}
		return
	}
	req = req.WithContext(r.Context())

	resp, err := s.mihomo.DoStream(req)
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
