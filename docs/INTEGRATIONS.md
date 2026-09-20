# v0.5.0 補充

新增的 jev_assess_candidates 是付費四問建議，不是核准；原四個 reviewer 工具不變。三個 App Skill 另用 `node bin/jev-ocu.mjs install-app-skills <agent>` 安裝。共用context和官方sky唯讀helper見 [證據規格](../skill/jev-desktop-context/references/context.md)；OCU 只作顯式選用的外部後端，本專案不自動安裝或啟動。

# Agent 整合手冊

以下範例以 repository 根目錄為目前位置。設定產生器使用 `process.execPath` 和 repository 的絕對路徑，所以不依赖 GUI 程序的 PATH，也不要求在特定工作目錄啟動。主程序直接用 Node，不透過 `npm start` 輸出非協定內容。

## Pi Agent

```powershell
node bin/jev-ocu.mjs install pi
```

安裝到 `~/.pi/agent/skills/jev-ocu` 與 `~/.pi/agent/extensions/jev-ocu.ts`；後者指向目前 repository 的真正 Extension。啟動 Pi，或在已開啟的 Pi 使用 `/reload`。也可不安裝而以 `pi -e ./integrations/pi/index.ts --skill ./skill/jev-ocu` 測試。

目前 Pi 原始專案為 `earendil-works/pi`，原 `badlogic/pi-mono` 連結會重新導向；新版 TypeBox import 是 `typebox`。較舊安裝若只有 `@sinclair/typebox`，可用 `node bin/jev-ocu.mjs install pi --legacy`（更新既有安裝另加 `--force`）。只載入一種入口，避免工具重名。兩者共用 `src/pi.mjs`，不修改 Pi 核心；舊版宿主仍須實際測試相容性。

此 Extension 註冊五個審查工具，不假設 Pi 已原生支援 MCP，也不安裝任何未知的第三方 MCP bridge。Pi 自己的 browser / computer 工具必須另外存在。

## AGY / Google Antigravity

```powershell
node bin/jev-ocu.mjs config agy
node bin/jev-ocu.mjs install agy
```

產生 `mcpServers` 物件；合併其中 `jev-ocu` 條目到目前宿主的 MCP 設定。目前官方路徑為全域 `~/.gemini/config/mcp_config.json`、工作區 `.agents/mcp_config.json`；IDE 亦可從 Manage MCP Servers → View raw config 開啟實際使用的檔案。重載 MCP / 新開會話後確認五個工具可見。

`install agy` 全域 Skill 使用 `~/.gemini/config/skills`（IDE / Antigravity 2.0）。**AGY CLI 的全域 Skill 目錄另為 `~/.gemini/antigravity-cli/skills`**；CLI 全域安裝請用 `node bin/jev-ocu.mjs install agy-cli`，或使用 `install agy --workspace "你的工作區"`，裝到三種 surface 共用的 `.agents/skills`。不要將某一 surface 的全域目錄誤當成全部版本通用。

## OpenCode

```powershell
node bin/jev-ocu.mjs config opencode
node bin/jev-ocu.mjs install opencode
```

將輸出的 `mcp.jev-ocu` 合併到專案 `opencode.json` / `opencode.jsonc`，或目前使用的全域設定。格式是 `type:"local"`、`command:[Node絕對路徑,入口絕對路徑,"mcp"]`；不是其他宿主的 `mcpServers` 格式。保留現有 providers、agents、permissions 與其他 servers。

## Codex 與其他宿主

```powershell
node bin/jev-ocu.mjs config codex
node bin/jev-ocu.mjs install codex
```

Codex 片段是 TOML，合併到自己的 `~/.codex/config.toml`。使用 MCP，不需要 `cua_repl`。其他支援標準 STDIO MCP 的宿主可用 `config generic`，依其設定格式合併 `command/args`。`config claude` 提供相同通用 JSON 片段，不自動修改 Claude 權限。

ChatGPT 網頁不讀本機 STDIO 或本機 config.toml；本專案未提供遠端 HTTP 部署，不能把本機檔案路徑填入網頁連接器。

## 給主 Agent 的啟動指令

> 使用 jev-ocu reviewer。你保留任務拆分、觀察、工具選擇、完整參數、執行與驗收；Jev 只審查我已授權範圍內的一個具體動作。先取得新觀察，呼叫 prepare，做四項宿主檢查，再 review。ALLOW 後重新觀察，validate 通過才用你本來的工具執行一次。Jev 不可代你自主操作；DENY、過期或狀態改變都停止並重新規劃。不要傳金鑰或私人內容。

## JSON CLI / JavaScript

CLI 請使用 UTF-8 檔案，避免把私密觀察塞進 shell 指令列：

```powershell
node bin/jev-ocu.mjs review request.json
```

`request.json` 外層：

```json
{
  "proposal": {
    "goal": "Go to previous month",
    "observation": {
      "source": "uia", "app": "Calendar", "revision": "actual-view-revision",
      "observedAt": "ACTUAL_ISO_TIMESTAMP_WITH_TIMEZONE",
      "text": "September 2026",
      "elements": [{"id":"prev","role":"button","label":"Previous month","enabled":true}]
    },
    "action": {"type":"click","tool":"desktop_click","targetId":"prev","arguments":{"element_id":"prev"}}
  },
  "hostChecks": {"userAuthorized":true,"scopeChecked":true,"targetChecked":true,"dataMinimized":true}
}
```

這是結構示意，時間、元素及檢查必須來自真實觀察與實際授權，不可直接照填。工具參數格式由宿主決定；Jev-ocu 不替你猜任何廠商的 click API。退出碼：`0` ALLOW、`2` DENY、`1` 輸入／執行環境錯誤。

Node 模組可用 `import { ReviewSession } from './src/reviewer.mjs'`；建立 session 後，以 `session.call(toolName, input, {signal})` 呼叫同樣五個工具。離開會話請 `session.close()`。`askImpl` 僅供可信程式測試／依賴注入，不是暴露給模型的 MCP 欄位；不要把 mock 接到正式工作。
