package main

import (
	"log"
	"net/http"
	"os"

	"mihomo-web-manager/internal/app"
)

func main() {
	cfg := app.LoadConfig()
	
	if cfg.ManagerToken != "" {
		log.Printf("Manager token authentication enabled")
	}
	
	server := app.NewServer(cfg)
	
	log.Printf("Starting Mihomo Web Manager on %s", cfg.ListenAddr)
	log.Printf("Mihomo controller: %s", cfg.MihomoController)
	log.Printf("Config path: %s", cfg.MihomoConfigPath)
	log.Printf("Web dir: %s", cfg.WebDir)
	
	if err := http.ListenAndServe(cfg.ListenAddr, server.Routes()); err != nil {
		log.Fatalf("Server failed: %v", err)
		os.Exit(1)
	}
}
