package app

import (
	"os"
	"path/filepath"
	"runtime"
)

type Config struct {
	ListenAddr       string
	ManagerToken     string
	MihomoController string
	MihomoSecret     string
	MihomoConfigPath string
	BackupDir        string
	DataDir          string
	WebDir           string
	ServiceMode      string
	ContainerName    string
}

func LoadConfig() Config {
	cfg := Config{
		ListenAddr:       env("MWM_LISTEN", ":8080"),
		ManagerToken:     os.Getenv("MWM_TOKEN"),
		MihomoController: env("MIHOMO_CONTROLLER", "http://127.0.0.1:9090"),
		MihomoSecret:     os.Getenv("MIHOMO_SECRET"),
		MihomoConfigPath: env("MIHOMO_CONFIG", defaultConfigPath()),
		BackupDir:        env("MWM_BACKUP_DIR", "./backups"),
		DataDir:          env("MWM_DATA_DIR", "./data"),
		WebDir:           env("MWM_WEB_DIR", "./web/dist"),
		ServiceMode:      env("MWM_SERVICE_MODE", "systemd"),
		ContainerName:    env("MIHOMO_CONTAINER", "mihomo"),
	}
	if realPath, err := filepath.EvalSymlinks(cfg.MihomoConfigPath); err == nil {
		cfg.MihomoConfigPath = realPath
	}
	return cfg
}

func env(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func defaultConfigPath() string {
	if runtime.GOOS == "windows" {
		return "./config.yaml"
	}
	return "/etc/mihomo/config.yaml"
}
