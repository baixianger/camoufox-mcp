# Camoufox MCP

MCP server for browser automation using [Camoufox](https://camoufox.com/) - an anti-detection Firefox browser.

## Installation

```bash
npx camoufox-mcp
```

## Claude Desktop Configuration

Add to `claude_desktop_config.json`:

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

## Why Camoufox MCP?

| Feature | Camoufox MCP | Chrome DevTools MCP |
|---------|--------------|---------------------|
| Anti-detection | ✅ Built-in | ❌ |
| Fingerprint randomization | ✅ | ❌ |
| MainWorld eval (access `__NUXT__`, `__NEXT_DATA__`) | ✅ | ✅ |
| Proxy with GeoIP | ✅ | ❌ |
| Cookie popup dismissal | ✅ | ❌ |

## Settings

Create `~/.config/camoufox-mcp/settings.json`:

```json
{
  "browser": { "headless": false },
  "proxy": { "enabled": false, "server": "${PROXY_SERVER}" }
}
```

## See More

- [Camoufox](https://github.com/daijro/camoufox) - The anti-detection Firefox browser
- [camoufox-js](https://github.com/AnyFetch/camoufox-js) - JavaScript/TypeScript bindings

## License

MIT
