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
| **Features** | | |
| Cookie popup auto-dismiss | ✅ 50+ selectors | ❌ |
| User action recording | ✅ | ❌ |
| Network interception | ✅ | ✅ |
| Console capture | ✅ | ✅ |
| Performance tracing | ❌ | ✅ |
| **Browser** | | |
| Engine | Firefox (Gecko) | Chrome (Chromium) |
| Auto-install | ✅ ~150MB | ✅ |

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
  }
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
