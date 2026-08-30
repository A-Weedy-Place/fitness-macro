# Agent service

Local Node service that enriches the mobile app:
- food search
- barcode lookup
- voice transcript resolution
- weight and entry persistence
- export endpoint

## Environment variables
- `AGENT_PAIRING_TOKEN`: required secret shared with mobile app.
- `AGENT_PORT`: default `8787`.
- `USDA_API_KEY`: optional; enables USDA search fallback.

## Security
- All `/v1/*` endpoints require `x-agent-token` header by default.
- Keep service on trusted local network or loopback.

## Notes
- Data is kept in `agent/data/db.json`.
- Migrations are currently fixed at schema version `2`.
