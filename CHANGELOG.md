# Changelog

## [1.0.0] - 2026-03-16

### Features — 26 tools
- **Cards (7):** get, search, list by space/board, create, update, delete
- **Comments (4):** list, create, update, delete
- **Time Logs (5):** get by user/card, create, update, delete
- **Spaces & Boards (7):** list spaces/boards/columns/lanes/card types, get space, get board
- **Users (3):** current user, list users, user roles

### Search & Filtering
- Filters: board, space, column, lane, owner, type, state, dates, urgency, overdue
- Multi-ID filters: owners, members, tags
- Default: 20 results, sorted by creation date (newest first)

### Response Optimization
- 4 verbosity levels: `min` (default), `normal`, `max`, `raw`
- `min` reduces response size by ~95%
- Auto-generated card URLs

### Reliability
- HTTP request timeout via `AbortController` (default 10s)
- Automatic retries with exponential backoff (429, 5xx, network errors, timeouts)
- `Retry-After` header support
- TTL cache for reference data (spaces, boards, columns, lanes, card types, users)
- Response truncation at 100k chars
- Crash protection
- Env validation via Zod at startup

### Configuration
- `KAITEN_API_TOKEN` — API token (required)
- `KAITEN_URL` — instance URL (required)
- `KAITEN_DEFAULT_SPACE_ID` — auto-applied to search
- `KAITEN_REQUEST_TIMEOUT_MS` — HTTP timeout (default 10000)
- `KAITEN_CACHE_TTL_MS` — cache TTL (default 300000, 0 to disable)
