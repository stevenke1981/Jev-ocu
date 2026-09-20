# Jev-ocu v0.3.0

**讓 Pi Agent、AGY（Google Antigravity）、OpenCode、Codex 等共用 Jev 動作審查，不再綁定 Codex Computer Use。**

由 [Jev-cu v0.2.0](https://github.com/stevenke1981/Jev-cu/tree/a8e9098474111e15b0143efd31350ae85fc9491d) 的 OpenRouter 串接重構。原專案不變；這是獨立的新專案，不是將所有 `Codex` 字串換名。

```text
Pi / AGY / OpenCode / Codex / 其他主 Agent
   │ 自己觀察 UI、決定動作與參數
   ▼
MCP STDIO / Pi Extension / JSON CLI / JavaScript 模組
   │ prepare → 宿主四項檢查 → review
   ▼
OpenRouter typesafe/jev-1.13 → ALLOW / DENY
   │ ALLOW 後重新觀察、比對並消耗本次審查
   ▼
主 Agent 用原本工具執行一次 → 讀取結果、驗收
```

**Jev 不操作電腦、不選下一步、不啟動自主迴圈。** 安裝本專案不會自動提供桌面或瀏覽器控制能力；主 Agent 必須已有相應工具與權限。

## 快速開始

需要 Node.js 22 或以上。核心零第三方依賴，無需編譯或安裝 npm 套件。

```powershell
git clone https://github.com/stevenke1981/Jev-ocu.git
cd Jev-ocu
npm test
npm run demo
npm run doctor
```

`demo` 是標示 MOCK 的完整離線流程，不連 OpenRouter、不操作桌面。`doctor` 只檢查設定，不揭露金鑰。

建立專案根目錄 `.env.local`：

```dotenv
OPENROUTER_API_KEY=你的OpenRouter金鑰
```

不要把真實金鑰貼到聊天或提交 Git。既有檔案只編輯相關欄位，不覆蓋其他內容。程序環境優先；亦可在啟動程序的環境指定 `JEV_ENV_FILE` 的絕對路徑。不讀取旧 `TYPESAFE_API_KEY`，不切回 TypeSafe，也不切換其他模型。

| 項目 | 固定設定 |
|---|---|
| API | `POST https://openrouter.ai/api/alpha/decisions` |
| 模型 | `typesafe/jev-1.13` |
| 請求 | `model` + `state` + `questions`，不是 Chat Completions |
| 回覆 | `ALLOW` 或 `DENY`，一律 `executed:false` |

成本優先採用 API 回傳 `usage.cost`；沒有費用但有輸入 token 時，按 2026-09-20 的 Jev 1.13 參考輸入價估算並標示來源，資訊不足為 `null`，不當作免費。官方來源見 [docs/SOURCES.md](docs/SOURCES.md)。

## 各 Agent 接入

| 宿主 | 入口 | 指令／文件 |
|---|---|---|
| Pi Agent | 原生 Extension + Skill | `node bin/jev-ocu.mjs install pi` |
| AGY / Antigravity | STDIO MCP + Skill | `node bin/jev-ocu.mjs config agy` |
| OpenCode | STDIO MCP + Skill | `node bin/jev-ocu.mjs config opencode` |
| Codex | STDIO MCP + Skill | `node bin/jev-ocu.mjs config codex` |
| 其他 MCP 宿主 | STDIO MCP | `node bin/jev-ocu.mjs config generic` |
| 其他有程序呼叫能力的 Agent | JSON CLI | `node bin/jev-ocu.mjs review request.json` |

`config` 會產生**符合該宿主格式、含本機 Node 與專案絕對路徑**的設定片段，不含 API key。將該 server 條目合併到既有設定，**不要整份覆蓋**。完整操作見 [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)。

安裝 Skill 範例：

```powershell
node bin/jev-ocu.mjs install pi
node bin/jev-ocu.mjs install agy        # IDE / Antigravity 2.0
node bin/jev-ocu.mjs install agy-cli    # AGY CLI
node bin/jev-ocu.mjs install opencode
node bin/jev-ocu.mjs install codex
```

只執行要使用的 Agent。預設不覆寫既有 Skill；更新時加 `--force`，會先建立備份。`--workspace "D:\your-project"` 可改裝到專案範圍。安裝器不修改宿主 MCP 設定、不更動全域安全權限；Pi 另寫入 Extension loader。repository 搬家後須重新產生設定及安裝 loader。

## 四個工具

| 工具 | 行為 |
|---|---|
| `jev_info` | 本機設定、模型、限制；不呼叫 API |
| `jev_prepare_review` | 綁定完整動作與文字觀察，列出四項宿主檢查 |
| `jev_review_action` | 審查該動作；唯一呼叫付費 API 的工具 |
| `jev_validate_review` | 新觀察與原動作比對，消耗一次性 session 狀態；不執行 |

MCP / Pi 每個連線有獨立記憶，最多 64 個待審記錄；中斷即失效。沒有持久化授權、背景任務、shell/eval/desktop_execute MCP 工具。

`proposal.observation` 接受 `uia/ax/dom/text` 來源標記，**這些是共同輸入格式，不是內建擷取驅動**。宿主將現有工具結果轉成 `app/revision/observedAt/text/elements`；`action` 包含 `type/tool/targetId/arguments`。所有 action 都需要本次觀察的作用目標，頁面或視窗本身亦可作為元素。

`examples/proposal.json` 是格式範例，故意保留過期時間，不能直接當成真實觀察。真實 CLI 輸入為 `{ "proposal": ..., "hostChecks": ... }`；完整範例與可貼給 Agent 的指令见整合文件。`node bin/jev-ocu.mjs schema` 可列出完整結構。

## 安全與驗收界線

四項 `hostChecks` 是呼叫端聲明，**不是可信授權系統**。Jev 的 ALLOW 只是建議，不能取代宿主權限或使用者授權；本專案不能攔截宿主繞過它的原有工具。敏感操作需針對本次動作的明確授權，模型仍可拒絕。確認不確定時停下，不以降低門檻求通過。

過期觀察、變更動作、目標不存在、缺少檢查、模型異常、低通過機率、高風險、取消與 API 錯誤均不放行。觀察與審查有效期各 60 秒；精確參數及狀態 hash 必須相同。內建秘密字串檢查僅是輔助，不是完整脫敏；UI 文字和 action arguments 會傳給 OpenRouter / TypeSafe，應先移除私人與敏感資料。

CLI 是單次無狀態審查，JSON 不可作為可轉交的安全票券；需要伺服器側一次性比對時用 MCP / Pi。所有入口都不代表實際桌面操作已完成。

## 驗證與遷移

`npm test` 包含 provider 模擬、reviewer 邊界、真正 STDIO 子程序握手、CLI、設定產生器、安裝備份、Pi mock host 註冊與 session 生命週期測試。沒有真實 API 金鑰測試，也不宣稱在每個 Agent UI 或 Windows/macOS 桌面完成端到端驗收。CI 定義涵蓋 Linux / Windows / macOS 與 Node 22 / 24，結果以 GitHub Actions 實際狀態為準。

v0.3.0 是介面重構：不再提供舊 `runTask/createCuaDriver` 自主執行模式與 Codex 專用日曆示範。舊 AX 選元素評測不混入新版 ALLOW/DENY 測試；需要舊模式請使用原 Jev-cu repository。新版純 JavaScript API 是 `ReviewSession.call()`，可在任何 Node 宿主重用。

## 檔案

`src/` 共用 API、審查核心、MCP、Pi adapter、安裝器；`bin/` CLI；`integrations/pi/` Pi 入口；`skill/jev-ocu/` 單一來源 Skill；`examples/` 資料格式；`tests/` 離線測試；`docs/` 整合說明與官方來源。
