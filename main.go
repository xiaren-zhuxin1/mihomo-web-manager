package main

import (
	"log"
	"net/http"

	"mihomo-web-manager/internal/app"
)

func main() {
	cfg := app.LoadConfig()

	addr := cfg.ListenAddr

	server := app.NewServer(cfg)
	log.Printf("Mihomo Web Manager starting on %s", addr)
	log.Printf("Mihomo controller: %s", cfg.MihomoController)
	log.Printf("Config path: %s", cfg.MihomoConfigPath)
	if cfg.MihomoSecret != "" {
		log.Printf("Mihomo secret: configured")
	} else {
		log.Printf("Mihomo secret: not configured")
	}

	if err := http.ListenAndServe(addr, server.Routes()); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
