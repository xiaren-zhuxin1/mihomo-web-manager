package app

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

func (s *Server) handleServiceStatus(w http.ResponseWriter, r *http.Request) {
	if s.cfg.ServiceMode == "docker" {
		out, err := runDocker("inspect", "-f", "{{.State.Status}}", s.cfg.ContainerName)
		writeJSON(w, http.StatusOK, map[string]any{
			"active": strings.TrimSpace(out) == "running",
			"output": strings.TrimSpace(out),
			"error":  errorString(err),
		})
		return
	}

	out, err := runSystemctl("is-active", "mihomo")
	writeJSON(w, http.StatusOK, map[string]any{
		"active": strings.TrimSpace(out) == "active",
		"output": strings.TrimSpace(out),
		"error":  errorString(err),
	})
}

func (s *Server) handleServiceAction(w http.ResponseWriter, r *http.Request) {
	action := r.PathValue("action")
	switch action {
	case "start", "stop", "restart", "reload":
	default:
		writeError(w, http.StatusBadRequest, "unsupported service action")
		return
	}
	if s.cfg.ServiceMode == "docker" {
		dockerAction := action
		if action == "reload" {
			dockerAction = "restart"
		}
		out, err := runDocker(dockerAction, s.cfg.ContainerName)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"output": strings.TrimSpace(out),
				"error":  err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"output": strings.TrimSpace(out)})
		return
	}

	out, err := runSystemctl(action, "mihomo")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"output": strings.TrimSpace(out),
			"error":  err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": strings.TrimSpace(out)})
}

func runSystemctl(args ...string) (string, error) {
	if runtime.GOOS == "windows" {
		return "", fmt.Errorf("systemd service management is only available on Linux")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "systemctl", args...)
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	err := cmd.Run()
	return output.String(), err
}

func runDocker(args ...string) (string, error) {
	if runtime.GOOS == "windows" {
		return "", fmt.Errorf("docker service management is only available on Linux")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", args...)
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	err := cmd.Run()
	return output.String(), err
}
