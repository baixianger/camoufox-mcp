<div align="center">

# 🦊 Camoufox MCP

**Anti-detection browser automation for AI agents**

[![npm version](https://img.shields.io/npm/v/camoufox-mcp.svg)](https://npmjs.org/package/camoufox-mcp)
[![npm downloads](https://img.shields.io/npm/dm/camoufox-mcp.svg)](https://npmjs.org/package/camoufox-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

MCP server for browser automation using [Camoufox](https://camoufox.com/) - an anti-detection Firefox browser.

</div>

## Installation

```bash
npx camoufox-mcp
```

## Claude Desktop Configuration

Add to `claude_desktop_config.json`:

**Basic:**
```json
{
  "mcpServers": {
    "camoufox": {
      "command": "npx",
      "args": ["camoufox-mcp"]
    }
  }
}
```

**With Proxy (via env vars):**
```json
{
  "mcpServers": {
    "camoufox": {
      "command": "npx",
      "args": ["camoufox-mcp"],
      "env": {
        "PROXY_SERVER": "http://1.2.3.4:8080",
        "PROXY_USER": "username",
        "PROXY_PASS": "password"
      }
    }
  }
}
```

Then in `~/.config/camoufox-mcp/settings.json`:
```json
{
  "proxy": {
    "enabled": true,
    "server": "${PROXY_SERVER}",
    "username": "${PROXY_USER}",
    "password": "${PROXY_PASS}",
    "geoip": true
  }
}
```

## Why Camoufox MCP?

| Feature | Camoufox MCP | Chrome DevTools MCP |
|---------|--------------|---------------------|
| **Anti-Detection** | | |
| Bot detection bypass | ✅ Built-in | ❌ Detected |
| Fingerprint randomization | ✅ | ❌ |
| WebRTC leak protection | ✅ | ❌ |
| Canvas fingerprint spoofing | ✅ | ❌ |
| **Automation** | | |
| Humanized cursor movement | ✅ Realistic paths | ❌ Instant jumps |
| Click with human-like delays | ✅ | ❌ |
| Proxy with GeoIP auto-config | ✅ Timezone/locale | ❌ Manual |
| **JavaScript Evaluation** | | |
| MainWorld eval (`__NUXT__`, `__NEXT_DATA__`) | ✅ | ✅ |
| Isolated eval (async/await) | ✅ | ✅ |
| **Session Management** | | |
| Isolated browser sessions | ✅ Multiple contexts | ❌ Single context |
| Pre-authenticated sessions | ✅ Cookie/localStorage injection | ❌ |
| Session state export | ✅ Save to JSON | ❌ |
| **Features** | | |
| Cookie popup auto-dismiss | ✅ 50+ selectors | ❌ |
| User action recording | ✅ | ❌ |
| Network interception | ✅ | ✅ |
| Console capture | ✅ | ✅ |
| Performance tracing | ❌ | ✅ |
| **Browser** | | |
| Engine | Firefox (Gecko) | Chrome (Chromium) |
| Auto-install | ✅ ~150MB | ✅ |

## Tools

### Session Management

Sessions provide isolated browser contexts — each session has its own cookies, localStorage, and cache. Use sessions to run multiple authenticated profiles simultaneously.

| Tool | Description |
|------|-------------|
| `create_session` | Create a new isolated session, optionally pre-loading cookies/localStorage from a JSON file |
| `list_sessions` | List all sessions with their page counts and metadata |
| `save_session` | Export a session's cookies and localStorage to a JSON file |
| `close_session` | Close a session and all its pages |

### Page Management

| Tool | Description |
|------|-------------|
| `new_page` | Create a new page, optionally in a specific session |
| `list_pages` | List all open pages with their session IDs |
| `select_page` | Set a page as active |
| `close_page` | Close a page |

### Navigation & Interaction

| Tool | Description |
|------|-------------|
| `navigate_page` | Navigate to URL, back, forward, or reload |
| `click` | Click an element by UID |
| `hover` | Hover over an element |
| `fill` | Fill a form field |
| `fill_form` | Fill multiple form fields at once |
| `press_key` | Press a key or key combination |
| `drag` | Drag an element to another |

### Inspection

| Tool | Description |
|------|-------------|
| `take_snapshot` | Text snapshot with interactive element UIDs |
| `take_screenshot` | Screenshot of page or element |
| `get_page_text` | Extract text content |
| `evaluate_mainworld` | Run JS in page context (sync only) |
| `evaluate_isolated` | Run JS in isolated context (async OK) |
| `get_framework_state` | Extract Next.js/Nuxt.js state |

### Context Injection

| Tool | Description |
|------|-------------|
| `inject_context` | Inject cookies + localStorage from a JSON file into a session |

### Monitoring

| Tool | Description |
|------|-------------|
| `start_network_capture` / `stop_network_capture` | Capture network requests |
| `get_network_logs` / `clear_network_logs` | View/clear captured requests |
| `intercept_network` / `remove_intercept` | Block or modify requests |
| `start_console_capture` / `stop_console_capture` | Capture console messages |
| `get_console_logs` / `clear_console_logs` | View/clear console messages |
| `start_recording` / `stop_recording` / `get_recording_status` | Record user interactions |

### Utility

| Tool | Description |
|------|-------------|
| `dismiss_popups` | Auto-dismiss cookie consent popups |
| `wait_for` | Wait for text or selector |
| `wait_for_navigation` | Wait for navigation to complete |
| `reload_settings` | Reload settings from config |
| `get_config_paths` | Show config file paths |
| `init_user_config` | Initialize user config directory |

## Sessions

Sessions enable running multiple authenticated profiles in parallel. Each session is an isolated browser context with its own cookies and localStorage.

```
Browser (single Camoufox instance)
  ├── Session "github" (cookies from github.json)
  │     ├── Page: github.com
  │     └── Page: github.com/repo
  ├── Session "linkedin" (cookies from linkedin.json)
  │     └── Page: linkedin.com/feed
  └── Session "default" (no pre-loaded state)
        └── Page: example.com
```

### Usage Examples

**Create a session with pre-loaded authentication:**
1. `create_session` with `contextPath: "github-cookies.json"` — returns a `sessionId`
2. `new_page` with `url: "https://github.com"` and the `sessionId` — opens GitHub already logged in

**Run two accounts simultaneously:**
1. `create_session` with `contextPath: "account1.json"` — session A
2. `create_session` with `contextPath: "account2.json"` — session B
3. `new_page` in session A — logged in as account 1
4. `new_page` in session B — logged in as account 2

**Save session state for later:**
1. Log in manually in a session
2. `save_session` with `outputPath: "my-session.json"` — exports cookies + localStorage
3. Next time, `create_session` with `contextPath: "my-session.json"` — restored

### Context File Format

Context files use [Playwright's storageState format](https://playwright.dev/docs/api/class-browsercontext#browser-context-storage-state):

```json
{
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123",
      "domain": ".example.com",
      "path": "/",
      "expires": 1735689600,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://example.com",
      "localStorage": [
        { "name": "token", "value": "xyz789" }
      ]
    }
  ]
}
```

### Auto-Creating Sessions from Settings

Add context file paths to `settings.json` — sessions are automatically created on startup:

```json
{
  "contextPaths": [
    "/path/to/github-cookies.json",
    "/path/to/linkedin-cookies.json"
  ]
}
```

## Settings

Create `~/.config/camoufox-mcp/settings.json`:

```json
{
  "browser": {
    "headless": false,
    "viewport": [1280, 1080],
    "timeout": 30000,
    "humanize": 0.5
  },
  "proxy": {
    "enabled": true,
    "server": "http://proxy.example.com:8080",
    "username": "user",
    "password": "pass",
    "geoip": true
  },
  "contextPaths": []
}
```

### Proxy Examples

**HTTP/HTTPS Proxy:**
```json
{ "proxy": { "enabled": true, "server": "http://1.2.3.4:8080" } }
```

**SOCKS5 Proxy:**
```json
{ "proxy": { "enabled": true, "server": "socks5://1.2.3.4:1080" } }
```

**With Authentication (using env vars):**
```json
{
  "proxy": {
    "enabled": true,
    "server": "${PROXY_SERVER}",
    "username": "${PROXY_USER}",
    "password": "${PROXY_PASS}",
    "geoip": true
  }
}
```

> `geoip: true` auto-adjusts browser timezone/locale based on proxy IP location.

## See More

- [Camoufox](https://github.com/daijro/camoufox) - The anti-detection Firefox browser
- [camoufox-js](https://github.com/AnyFetch/camoufox-js) - JavaScript/TypeScript bindings

## License

MIT
