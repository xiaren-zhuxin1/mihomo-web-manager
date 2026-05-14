package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type RecoveryEvent struct {
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Action    string    `json:"action,omitempty"`
	Success   bool      `json:"success"`
	Detail    string    `json:"detail,omitempty"`
}

type RecoveryStatus struct {
	Enabled          bool            `json:"enabled"`
	MihomoAlive      bool            `json:"mihomoAlive"`
	LastCheck        time.Time       `json:"lastCheck"`
	LastRecovery     *time.Time      `json:"lastRecovery,omitempty"`
	RecoveryCount    int             `json:"recoveryCount"`
	ConsecutiveFails int             `json:"consecutiveFails"`
	ConfigHealthy    bool            `json:"configHealthy"`
	RecentEvents     []RecoveryEvent `json:"recentEvents"`
}

type Guardian struct {
	server       *Server
	enabled      bool
	checkInterval time.Duration
	maxConsecutiveFails int
	recoveryCooldown   time.Duration

	mu              sync.RWMutex
	mihomoAlive     bool
	lastCheck       time.Time
	lastRecovery    *time.Time
	recoveryCount   int
	consecutiveFails int
	configHealthy   bool
	events          []RecoveryEvent
	stopCh          chan struct{}
	stopped         bool
}

func NewGuardian(server *Server) *Guardian {
	return &Guardian{
		server:             server,
		enabled:            true,
		checkInterval:      15 * time.Second,
		maxConsecutiveFails: 3,
		recoveryCooldown:   30 * time.Second,
		events:             make([]RecoveryEvent, 0, 100),
	}
}

func (g *Guardian) Start() {
	if !g.enabled {
		return
	}
	g.stopCh = make(chan struct{})
	go g.run()
	log.Printf("[Guardian] Started - interval: %s, max fails: %d", g.checkInterval, g.maxConsecutiveFails)
}

func (g *Guardian) Stop() {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.stopped {
		return
	}
	g.stopped = true
	close(g.stopCh)
	log.Printf("[Guardian] Stopped")
}

func (g *Guardian) GetStatus() RecoveryStatus {
	g.mu.RLock()
	defer g.mu.RUnlock()

	events := make([]RecoveryEvent, len(g.events))
	copy(events, g.events)

	return RecoveryStatus{
		Enabled:          g.enabled,
		MihomoAlive:      g.mihomoAlive,
		LastCheck:        g.lastCheck,
		LastRecovery:     g.lastRecovery,
		RecoveryCount:    g.recoveryCount,
		ConsecutiveFails: g.consecutiveFails,
		ConfigHealthy:    g.configHealthy,
		RecentEvents:     events,
	}
}

func (g *Guardian) SetEnabled(enabled bool) {
	g.mu.Lock()
	g.enabled = enabled
	g.mu.Unlock()
	if enabled && g.stopped {
		g.stopped = false
		g.stopCh = make(chan struct{})
		go g.run()
	}
}

func (g *Guardian) run() {
	ticker := time.NewTicker(g.checkInterval)
	defer ticker.Stop()

	g.check()

	for {
		select {
		case <-g.stopCh:
			return
		case <-ticker.C:
			g.check()
		}
	}
}

func (g *Guardian) check() {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.lastCheck = time.Now()

	alive := g.checkMihomoAlive()
	g.mihomoAlive = alive

	if alive {
		g.consecutiveFails = 0
		g.configHealthy = g.checkConfigHealth()
		return
	}

	g.consecutiveFails++
	g.recordEvent("health_check", "warning", fmt.Sprintf("Mihomo not responding (fail %d/%d)", g.consecutiveFails, g.maxConsecutiveFails), "", false, "")

	if g.consecutiveFails >= g.maxConsecutiveFails {
		g.attemptRecovery()
	}
}

func (g *Guardian) checkMihomoAlive() bool {
	client := &http.Client{Timeout: 5 * time.Second}
	url := strings.TrimRight(g.server.cfg.MihomoController, "/") + "/version"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false
	}
	if g.server.cfg.MihomoSecret != "" {
		req.Header.Set("Authorization", "Bearer "+g.server.cfg.MihomoSecret)
	}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

func (g *Guardian) checkConfigHealth() bool {
	data, err := os.ReadFile(g.server.cfg.MihomoConfigPath)
	if err != nil {
		g.recordEvent("config_health", "error", "Config file unreadable: "+err.Error(), "", false, "")
		return false
	}
	if len(data) == 0 {
		g.recordEvent("config_health", "error", "Config file is empty", "", false, "")
		return false
	}
	return true
}

func (g *Guardian) attemptRecovery() {
	if g.lastRecovery != nil && time.Since(*g.lastRecovery) < g.recoveryCooldown {
		g.recordEvent("recovery", "warning", "Recovery skipped - cooldown period", "skip", false, "")
		return
	}

	now := time.Now()
	g.lastRecovery = &now
	g.recoveryCount++

	g.recordEvent("recovery", "info", "Starting recovery attempt", "start", true, fmt.Sprintf("attempt #%d", g.recoveryCount))

	if g.tryRestartService() {
		time.Sleep(3 * time.Second)
		if g.checkMihomoAlive() {
			g.mihomoAlive = true
			g.consecutiveFails = 0
			g.recordEvent("recovery", "info", "Recovery successful - mihomo is alive", "restart", true, "")
			return
		}
	}

	if g.tryRestoreConfig() {
		time.Sleep(3 * time.Second)
		if g.checkMihomoAlive() {
			g.mihomoAlive = true
			g.consecutiveFails = 0
			g.configHealthy = true
			g.recordEvent("recovery", "info", "Recovery successful - config restored", "restore_config", true, "")
			return
		}
	}

	if g.tryKillAndStart() {
		time.Sleep(5 * time.Second)
		if g.checkMihomoAlive() {
			g.mihomoAlive = true
			g.consecutiveFails = 0
			g.recordEvent("recovery", "info", "Recovery successful - force restart", "force_restart", true, "")
			return
		}
	}

	g.recordEvent("recovery", "error", "All recovery attempts failed", "failed", false, fmt.Sprintf("consecutive fails: %d", g.consecutiveFails))
}

func (g *Guardian) tryRestartService() bool {
	g.recordEvent("recovery", "info", "Attempting service restart", "restart", true, "")

	if g.server.cfg.ServiceMode == "docker" {
		out, err := runDocker("restart", g.server.cfg.ContainerName)
		if err != nil {
			g.recordEvent("recovery", "error", "Docker restart failed: "+err.Error(), "restart", false, out)
			return false
		}
		return true
	}

	if runtime.GOOS == "windows" {
		return false
	}

	out, err := runSystemctl("restart", "mihomo")
	if err != nil {
		g.recordEvent("recovery", "error", "Systemctl restart failed: "+err.Error(), "restart", false, out)
		return false
	}
	return true
}

func (g *Guardian) tryRestoreConfig() bool {
	backups, err := g.server.configStore.ListBackups()
	if err != nil || len(backups) == 0 {
		g.recordEvent("recovery", "warning", "No config backups available", "restore_config", false, "")
		return false
	}

	latestBackup := backups[0]
	g.recordEvent("recovery", "info", "Restoring config from backup: "+latestBackup.Name, "restore_config", true, "")

	if err := g.server.configStore.RestoreBackup(latestBackup.Name); err != nil {
		g.recordEvent("recovery", "error", "Config restore failed: "+err.Error(), "restore_config", false, "")
		return false
	}

	status, _, err := g.server.mihomo.Reload()
	if err != nil || status >= 300 {
		g.recordEvent("recovery", "warning", "Config restored but reload failed", "restore_config", false, fmt.Sprintf("status: %d", status))
		return false
	}

	return true
}

func (g *Guardian) tryKillAndStart() bool {
	if runtime.GOOS == "windows" {
		return false
	}

	g.recordEvent("recovery", "info", "Attempting force kill and restart", "force_restart", true, "")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	killCmd := exec.CommandContext(ctx, "pkill", "-9", "mihomo")
	killCmd.Run()
	time.Sleep(2 * time.Second)

	if g.server.cfg.ServiceMode == "docker" {
		out, err := runDocker("start", g.server.cfg.ContainerName)
		if err != nil {
			g.recordEvent("recovery", "error", "Docker start failed: "+err.Error(), "force_restart", false, out)
			return false
		}
		return true
	}

	out, err := runSystemctl("start", "mihomo")
	if err != nil {
		g.recordEvent("recovery", "error", "Systemctl start failed: "+err.Error(), "force_restart", false, out)
		return false
	}
	return true
}

func (g *Guardian) recordEvent(eventType, level, message, action string, success bool, detail string) {
	event := RecoveryEvent{
		Timestamp: time.Now(),
		Type:      eventType,
		Level:     level,
		Message:   message,
		Action:    action,
		Success:   success,
		Detail:    detail,
	}

	g.events = append(g.events, event)
	if len(g.events) > 100 {
		g.events = g.events[len(g.events)-100:]
	}

	prefix := "[Guardian]"
	if level == "error" {
		prefix = "[Guardian] ERROR:"
	} else if level == "warning" {
		prefix = "[Guardian] WARN:"
	}
	log.Printf("%s %s (action=%s success=%v)", prefix, message, action, success)
}

func (g *Guardian) HandleGetStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, g.GetStatus())
}

func (g *Guardian) HandleSetEnabled(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	g.SetEnabled(payload.Enabled)
	writeJSON(w, http.StatusOK, map[string]any{"enabled": payload.Enabled})
}

func (g *Guardian) HandleTriggerRecovery(w http.ResponseWriter, r *http.Request) {
	g.mu.Lock()
	g.consecutiveFails = g.maxConsecutiveFails
	g.mu.Unlock()
	go g.check()
	writeJSON(w, http.StatusOK, map[string]any{"triggered": true})
}

func (g *Guardian) HandleGetEvents(w http.ResponseWriter, r *http.Request) {
	g.mu.RLock()
	events := make([]RecoveryEvent, len(g.events))
	copy(events, g.events)
	g.mu.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{"events": events})
}

func (g *Guardian) LoadPersistedState() {
	statePath := filepath.Join(g.server.cfg.DataDir, "guardian_state.json")
	data, err := os.ReadFile(statePath)
	if err != nil {
		return
	}
	var state struct {
		RecoveryCount int       `json:"recoveryCount"`
		LastRecovery  *time.Time `json:"lastRecovery"`
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return
	}
	g.mu.Lock()
	g.recoveryCount = state.RecoveryCount
	g.lastRecovery = state.LastRecovery
	g.mu.Unlock()
}

func (g *Guardian) PersistState() {
	g.mu.RLock()
	state := struct {
		RecoveryCount int        `json:"recoveryCount"`
		LastRecovery  *time.Time `json:"lastRecovery"`
	}{
		RecoveryCount: g.recoveryCount,
		LastRecovery:  g.lastRecovery,
	}
	g.mu.RUnlock()

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return
	}
	statePath := filepath.Join(g.server.cfg.DataDir, "guardian_state.json")
	os.MkdirAll(g.server.cfg.DataDir, 0o750)
	os.WriteFile(statePath, data, 0o640)
}
