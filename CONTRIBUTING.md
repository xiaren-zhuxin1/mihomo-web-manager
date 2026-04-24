# Contributing

Thanks for helping improve Mihomo Web Manager.

## Development Setup

```bash
cd web
npm ci
npm run build
cd ..
go test ./...
go run ./cmd/mihomo-manager
```

## Pull Request Checklist

- Keep changes focused.
- Run `go test ./...`.
- Run `npm run build` in `web/`.
- Update documentation when behavior or environment variables change.
- Do not commit local subscriptions, backups, build artifacts, or `node_modules`.

## Code Style

- Backend code is formatted with `gofmt`.
- Frontend is React + TypeScript + plain CSS.
- Prefer small, obvious components until a repeated pattern emerges.

