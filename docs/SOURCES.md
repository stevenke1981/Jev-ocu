# 官方來源與介面核對

核對日期：2026-09-20。這些是介面實作依據，不等同於在各宿主內通過端到端測試。

- OpenRouter Jev 1.13：https://openrouter.ai/typesafe/jev-1.13
- OpenRouter OpenAPI：https://openrouter.ai/openapi.json ，`/api/alpha/decisions` 的 `model/state/questions` 與 `answers/usage`。
- MCP STDIO：https://modelcontextprotocol.io/specification/2025-06-18/basic/transports ，UTF-8、每行一個 JSON-RPC、stdout 不混入日誌。
- Pi Extension：https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md ，`registerTool`、execute signal、session lifecycle、TypeBox。
- Pi Skills：https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md
- OpenCode MCP：https://opencode.ai/docs/mcp-servers/ ，`mcp`、`type:local`、command array。
- OpenCode Skills：https://opencode.ai/docs/skills/
- Antigravity MCP：https://antigravity.google/docs/mcp ，`mcpServers`、command/args 與各 surface 設定。
- Antigravity Skills：https://antigravity.google/docs/skills ，workspace `.agents/skills`，各 surface 的全域目錄並不相同。
- Codex MCP：https://developers.openai.com/codex/mcp ，STDIO、`mcp_servers` TOML 與 timeout 設定。

本專案實作所需的最小 MCP STDIO 子集：initialize、initialized、ping、tools/list、tools/call、cancelled 與斷線清理。不提供 prompts/resources、遠端 HTTP、OAuth、MCP tasks 或持久化授權；不得宣稱完整實作所有 MCP 可選功能。Pi TypeBox 的真實宿主載入與各 Agent 的連線須由使用者環境驗證。
