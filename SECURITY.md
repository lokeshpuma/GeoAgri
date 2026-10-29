# Security Policy

## Supported Versions

Only the latest release (`v3.4.x`) receives security updates.

## Reporting a Vulnerability

If you discover a potential security vulnerability, please do NOT create a public GitHub issue.

Instead, please report it privately:
- Contact: `security@geoagri.ai` or project maintainers via private channels.
- Include detailed steps to reproduce, affected endpoints or components, and impact analysis.

## Secret Management

- Never commit private keys, service account JSON files, or API credentials to git.
- Secrets must be configured via environment variables or secret management in deployment targets (Render / Vercel).

