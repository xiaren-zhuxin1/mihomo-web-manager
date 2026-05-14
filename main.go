package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"mihomo-web-manager/internal/app"
)

func main() {
	cfg := app.LoadConfig()

	addr := cfg.ListenAddr

	server := app.NewServer(cfg)
	server.StartBackground()
	defer server.StopBackground()

	log.Printf("Mihomo Web Manager starting on %s", addr)
	log.Printf("Mihomo controller: %s", cfg.MihomoConfigPath)
	log.Printf("Config path: %s", cfg.MihomoConfigPath)
	if cfg.MihomoSecret != "" {
		log.Printf("Mihomo secret: configured")
	} else {
		log.Printf("Mihomo secret: not configured")
	}

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		sig := <-sigCh
		log.Printf("Received signal %v, shutting down...", sig)
		server.StopBackground()
		os.Exit(0)
	}()

	if err := http.ListenAndServe(addr, server.Routes()); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
