export const HELP_TEXT = `aideck — AI-native dashboard runtime

USAGE
  aideck <command> [options]

COMMANDS
  serve           Start HTTP server (dashboard + REST + SSE) on default port 7777
                  (auto-fallback to 7778..7787 if 7777 is busy and --port not given)
  demo            Run HTTP server with seeded fixtures (auto-opens browser)
  mcp             Run MCP server (stdio mode) — connect from Claude Code/Cursor via MCP config
  env             Print shell exports for AIDECK_URL/AIDECK_PORT (use: eval "$(aideck env)")

OPTIONS
  --port=<N>          Port for HTTP server (default 7777, ignored by 'mcp' and 'env')
                      If set explicitly and the port is busy, aideck exits 1.
  --static-dir=<path> Serve a prebuilt SPA bundle from <path> as a fallback handler
                      (serve only). API and SSE routes always take priority; any
                      non-API request that does not match a file falls back to
                      <path>/index.html for client-side routing.
  --config=<path>     Path to config file (default: none)
  -h, --help          Show this help
  -v, --version       Show version

EXAMPLES
  aideck demo
  aideck serve --port=8080
  aideck serve --static-dir=../atomic-skills/dist/dashboard
  aideck mcp                 # run separately; HTTP and MCP are independent processes
  eval "$(aideck env)"       # source AIDECK_URL/AIDECK_PORT in current shell

Docs: https://github.com/henryavila/aideck
`
