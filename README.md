# Jev-ocu v0.4.0

跨 Agent Jev 動作審查，新增 **Windows 原生 Computer Use**。支援 Codex、Pi Agent、AGY / Antigravity、OpenCode 與其他本機 MCP 宿主。

**主 Agent 決定動作、授權、執行與驗收；Jev 只回 ALLOW / DENY。** Windows driver 不會在 Jev 核准後自動執行，必須由主 Agent 另外呼叫一次。

```text
主 Agent → windows_observe（原生 UIA；必要時截圖）
         → windows_review（Jev 審查完整動作，沒有操作）
         → windows_execute（主 Agent 明確執行一次）
         → windows_observe（讀取結果、驗收）
```

## 兩種入口

| 入口 | 用途 | 啟動 |
|---|---|---|
| 新增 `jev-windows` | 真正的 Windows UIA、截圖、文字／鍵鼠單步操作 | `node windows/cli.mjs mcp` |
| 原有 `jev-ocu` | 通用審查層，宿主使用自己的操作工具 | `node bin/jev-ocu.mjs mcp` |

兩者是不同 server / session，不混用審查 ID。Windows 路徑已經包含 Jev 審查，不必再透過通用 reviewer 重複付費審查同一動作。原有四個 `jev_*` 工具保持只審查、不執行。

## Windows 快速開始

需要 **Windows 10/11、原生 Windows Node.js 22+、內建 Windows PowerShell 5.1 / .NET Framework**。不是 WSL 的 Linux Node。無額外 npm 或 Python 依賴；原生 C# 在本機啟動時編譯。

```powershell
git clone https://github.com/stevenke1981/Jev-ocu.git
cd Jev-ocu
npm run windows:doctor
node windows/cli.mjs list
```

在 repository 根目錄建立／編輯 `.env.local`，不要提交真實金鑰：

```dotenv
OPENROUTER_API_KEY=你的OpenRouter金鑰
```

環境變數優先；亦可用環境中的 `JEV_ENV_FILE` 指定檔案位置。模型固定 `typesafe/jev-1.13`、端點 `https://openrouter.ai/api/alpha/decisions`，不切回舊 TypeSafe 金鑰或其他模型。只有 review 呼叫付費 API；Windows list、observe、screenshot、doctor 和 dry-run 不呼叫模型。

### 安裝到 Agent

```powershell
# 只執行要使用的宿主
node windows/install.mjs codex
node windows/cli.mjs config codex

node windows/install.mjs agy         # IDE；AGY CLI 用 agy-cli
node windows/cli.mjs config agy

node windows/install.mjs opencode
node windows/cli.mjs config opencode

node windows/install.mjs pi          # 原生 Extension + Skill，之後 /reload
```

`config` 產生本機 Node 與專案的絕對路徑，不含金鑰。**只將 `jev-windows` 條目合併到既有 MCP 設定，不要整份覆蓋。** 更新已安装 Skill 時加 `--force` 會先備份；可用 `--workspace PATH` 安裝至工作區。舊 Pi 的 TypeBox 套件名稱不同時加 `--legacy`。

兩個 repository（Jev-cu / Jev-ocu）都有相同 Windows companion；**同一宿主只啟用其中一份**，不要重複註冊或同時控制桌面。原生 PowerShell worker 使用 `windowsHide:true`，不另開終端視窗；本版不是 GUI app。

## Windows 功能及界線

工具：`windows_info`、`windows_list`、`windows_observe`、`windows_screenshot`、`windows_review`、`windows_execute`、`windows_stop`。

支援 UIA Invoke／Value／Scroll／Toggle／Select、實體點擊、Unicode 文字輸入、有限按鍵組合、聚焦、等待，以及截圖雜湊驗證的座標點擊和拖曳。支援 DPI 實體座標與負的多螢幕原點。詳細參數見 [Windows 手冊](windows/README.md) 與 [動作格式](windows/ACTIONS.md)。

`windows_execute` 預設只做 dry-run；真實操作需 `dryRun:false` 和綁定精確動作的 reviewId。快照及核准最多 60 秒，執行前重新核對 UIA／視窗；實際嘗試消耗核准，不自動重播。`executed:true` 不等於任務完成，必須再觀察。逾時或取消可能代表動作已部分發生。

觀察上限 60 個輸出元素／300 個遍歷節點，會標示截斷。UIA 的可用程度依 App 而異，不等於瀏覽器 DOM。截圖只回給主 Agent，不送 Jev；文字觀察及动作文字會透過 OpenRouter 傳給模型，必須先限定範圍及去除私人資料。密碼欄位有基本遮蔽，但不代表完整隱私過濾。

不繞過 UAC、UIPI、鎖定／安全桌面或服務隔離，不自動提權。只使用 worker 子程序範圍的 PowerShell execution-policy 參數，不變更系統原則。`hostChecks` 是呼叫端聲明而非可信人工授權證明；本專案不是 OS sandbox，也不能攔截主 Agent 其他工具。

## 原有跨平台 reviewer

保留 MCP、Pi Extension、JSON CLI 與 `ReviewSession.call()`。既有設定仍可用，無需 Windows 才能審查。

```powershell
node bin/jev-ocu.mjs doctor
node bin/jev-ocu.mjs config opencode
node bin/jev-ocu.mjs install pi
node bin/jev-ocu.mjs review request.json
npm run demo
```

原有工具為 `jev_info`、`jev_prepare_review`、`jev_review_action`、`jev_validate_review`；prepare → 四項宿主檢查 → review → fresh-state validate → 宿主原本工具執行。CLI 是單次無狀態建議，不是可重播的核准票券。`demo` 完全模擬，不呼叫 API、不操作桌面。輸入範例在 `examples/proposal.json`；整合細節見 [Agent 手冊](docs/INTEGRATIONS.md)。

## 測試與版本

```powershell
npm test
npm run windows:test
```

離線測試涵蓋原 reviewer、OpenRouter 模擬、MCP／Pi、綁定、預覽、取消、一次性執行與安裝備份。Windows 另外測原生編譯及隔離 WinForms 視窗；**原生測試會建立自己的可見測試視窗**，不操作其他 App、不使用付費模型。Linux/macOS 會明確 skip 原生項目；無互動桌面時 GUI smoke 亦明確 skip。CI 為 Node 22/24 × Windows/Linux/macOS，結果以實際 job/log 為準。

隔離測試不等於使用者電腦、所有 App、顯示器與每個 Agent UI 都已完成端到端驗收。v0.4.0 在 v0.3.0 reviewer 上增加獨立 Windows companion；不恢復舊 Codex 自主 `runTask` 模式。來源與授權見 [NOTICE.md](NOTICE.md)、[LICENSE](LICENSE)、[官方介面來源](docs/SOURCES.md)。
