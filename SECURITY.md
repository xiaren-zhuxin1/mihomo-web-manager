# Security Policy

Mihomo Web Manager controls a local proxy core, reads and writes configuration files, and can restart services. Treat it as an administrative tool.

## Recommendations

- Always set `MWM_TOKEN`.
- Bind the manager to a private interface or place it behind a reverse proxy.
- Use HTTPS when accessing it over a network.
- Keep mihomo `external-controller` on `127.0.0.1` whenever possible.
- Do not publish your `MIHOMO_SECRET`, subscriptions, backups, or config files.

## Reporting Issues

Please open a private security advisory or contact the maintainers before publishing details of a vulnerability.

