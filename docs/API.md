# API Overview

All manager APIs are under `/api`.

If `MWM_TOKEN` is set, API clients or your reverse proxy must send:

```http
Authorization: Bearer <token>
```

## Health

```http
GET /api/health
```

## Mihomo Proxy

```http
/api/mihomo/*
```

Forwards to `MIHOMO_CONTROLLER`.

Examples:

```http
GET /api/mihomo/proxies
PUT /api/mihomo/proxies/{group}
GET /api/mihomo/providers/proxies
PUT /api/mihomo/providers/proxies/{name}
```

## Subscriptions

```http
GET /api/subscriptions
POST /api/subscriptions
POST /api/subscriptions/{id}/update
DELETE /api/subscriptions/{id}
```

Manager-owned subscriptions are downloaded by the manager and written as local mihomo `file` providers.

## Config

```http
GET /api/config
PUT /api/config
POST /api/config/backup
```

`PUT /api/config` creates a backup before writing.

## Service

```http
GET /api/service/status
POST /api/service/start
POST /api/service/stop
POST /api/service/restart
POST /api/service/reload
```

Service behavior depends on `MWM_SERVICE_MODE`.
