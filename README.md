# mcp-kaiten

[Русская версия](README.ru.md)

MCP server for **Kaiten** — cards, time-logs, boards, comments, users.

Connect Cursor, Claude Desktop, or any MCP client to your Kaiten workspace.

Start with a single command: `npx -y mcp-kaiten`.

---

## Quick Start

### 1. Get API Token

1. Go to your Kaiten instance (e.g. `https://your-domain.kaiten.ru`)
2. Open Profile → API Key
3. Create a new token and copy it

### 2. Add to Cursor / MCP Client

```json
{
  "mcpServers": {
    "mcp-kaiten": {
      "command": "npx",
      "args": ["-y", "mcp-kaiten"],
      "env": {
        "KAITEN_API_TOKEN": "your-api-token",
        "KAITEN_URL": "https://your-domain.kaiten.ru"
      }
    }
  }
}
```

The server starts automatically when the MCP client connects.

---

## What Can It Do?

### Cards

| Tool | Description |
|------|-------------|
| `kaiten_get_card` | Get card by ID (with optional children) |
| `kaiten_search_cards` | Search cards with filters, dates, pagination |
| `kaiten_get_space_cards` | Get cards in a space |
| `kaiten_get_board_cards` | Get cards on a board |
| `kaiten_create_card` | Create a new card |
| `kaiten_update_card` | Update card fields, move between columns/boards |
| `kaiten_delete_card` | Delete a card |

### Comments

| Tool | Description |
|------|-------------|
| `kaiten_get_card_comments` | List comments for a card |
| `kaiten_create_comment` | Add a comment |
| `kaiten_update_comment` | Update a comment |
| `kaiten_delete_comment` | Delete a comment |

### Time Logs

| Tool | Description |
|------|-------------|
| `kaiten_get_user_timelogs` | Get time-logs for a user in a date range |
| `kaiten_get_card_timelogs` | Get time-logs for a card |
| `kaiten_create_timelog` | Create a time-log entry (requires `roleId`) |
| `kaiten_update_timelog` | Update a time-log entry |
| `kaiten_delete_timelog` | Delete a time-log entry (requires `cardId`) |

### Spaces & Boards

| Tool | Description |
|------|-------------|
| `kaiten_list_spaces` | List all spaces |
| `kaiten_get_space` | Get space by ID |
| `kaiten_list_boards` | List boards in a space |
| `kaiten_get_board` | Get board by ID |
| `kaiten_list_columns` | List columns (statuses) of a board |
| `kaiten_list_lanes` | List lanes (swimlanes) of a board |
| `kaiten_list_card_types` | List card types of a board |

### Users

| Tool | Description |
|------|-------------|
| `kaiten_get_current_user` | Get the authenticated user |
| `kaiten_list_users` | List all users |
| `kaiten_get_user_roles` | Get roles of the current user |

---

## Authentication

Kaiten uses API tokens for authentication. OAuth is not supported by the Kaiten API.

1. Go to your Kaiten profile → API Key
2. Create and copy the token
3. Set `KAITEN_API_TOKEN` in MCP config

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KAITEN_API_TOKEN` | yes | API token (Bearer) |
| `KAITEN_URL` | yes | Kaiten instance URL (e.g. `https://your-domain.kaiten.ru`) |
| `KAITEN_DEFAULT_SPACE_ID` | no | Default space ID for card search (if `spaceId` is not specified) |
| `KAITEN_REQUEST_TIMEOUT_MS` | no | HTTP request timeout in ms (default: `10000`, range: 1000–60000) |
| `KAITEN_CACHE_TTL_MS` | no | TTL for spaces/boards/users cache in ms (default: `300000`, 0 to disable) |

---

## Verbosity

Every tool accepts an optional `verbosity` parameter (default: `min`):

| Level | Description | Card fields |
|-------|-------------|-------------|
| `min` | Compact, saves context | 9 fields: id, title, url, board, column, owner, updated, asap, blocked |
| `normal` | Useful fields | ~22 fields: + dates, state, tags, members, lane, type, size, due_date |
| `max` | Full analysis | ~30 fields: + description, checklists, blockers, external_links |
| `raw` | Full API response | All fields as returned by Kaiten API |

## Reliability

- **Request timeout:** configurable HTTP timeout via `AbortController` (default 10s). Prevents indefinite hangs on network issues.
- **Automatic retries:** failed requests (429, 408, 5xx, network errors, timeouts) are retried up to 3 times with exponential backoff and jitter. `Retry-After` header is respected.
- **TTL cache:** spaces, boards, columns, lanes, card types, and users are cached in memory (default 5 min). Eliminates redundant API calls for reference data.
- **Env validation:** all configuration is validated at startup via Zod. Invalid values produce clear error messages and prevent silent failures.
- **Response truncation:** responses over 100k characters are automatically truncated to prevent context overflow.
- **Crash protection:** uncaught exceptions and unhandled rejections are logged to stderr without crashing the server.

## Known Limitations

- **Rate limits:** Kaiten API may throttle requests. Retries handle transient 429 errors, but sustained overload requires reducing request frequency.

## Troubleshooting

- **Server won't start:** check that `KAITEN_API_TOKEN` and `KAITEN_URL` are set in the MCP config `env` block.
- **401 errors:** token may be expired or invalid. Generate a new one in Kaiten profile.
- **502 errors:** Kaiten instance may be temporarily unavailable. The server will retry automatically.
- **Large responses:** use filters (`boardId`, `spaceId`) or lower `limit` to reduce response size.

## License

[MIT](LICENSE)
