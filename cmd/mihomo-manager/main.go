package main

import (
	"log"
	"net/http"

	"mihomo-web-manager/internal/app"
)

func main() {
	cfg := app.LoadConfig()
	server := app.NewServer(cfg)

	log.Printf("mihomo web manager listening on %s", cfg.ListenAddr)
	log.Printf("mihomo controller: %s", cfg.MihomoController)
	if err := http.ListenAndServe(cfg.ListenAddr, server.Routes()); err != nil {
		log.Fatal(err)
	}
}
