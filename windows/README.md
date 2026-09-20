# Windows Computer Use 1.0.0

`Jev-cu` 與 `Jev-ocu` 共用的 **原生 Windows 桌面操作 companion**。不是只將 `source` 改成 `uia`：本目錄實作真正的 Windows UI Automation、視窗列舉、截圖與 SendInput。

主 Agent 決定動作 → `windows_review` 讓 Jev 回 ALLOW/DENY → 主 Agent **另行呼叫** `windows_execute` → 重新讀取結果驗收。review 絕不自動執行。

## 安裝及環境

Windows 10/11、原生 Windows Node.js 22 或以上、內建 Windows PowerShell 5.1（.NET Framework）。不用 Python、額外 npm 套件或預先編譯 EXE。啟動時由本機 Add-Type 編譯 `native.cs`；子程序使用 `windowsHide:true`，不另外拖著 PowerShell 終端視窗。CLI 自己仍是命令列，不宣稱提供 GUI app。

```powershell
# 在該 repository 根目錄
npm run windows:doctor
node windows/cli.mjs list
node windows/install.mjs codex          # 或 pi、agy、agy-cli、opencode
node windows/cli.mjs config codex       # 或 agy、opencode、generic
```

將 `config` 輸出的 **jev-windows 條目**合併至宿主 MCP 設定，不要覆蓋其他伺服器或權限。既有 Jev-ocu reviewer server 可保留，但 Windows 這條路徑不必重複呼叫通用 reviewer。兩個 repository 的 companion 相同，**同一宿主只啟用其中一份**，避免工具重名或同時控制桌面。

API key 使用該 repository 原有 `.env.local` 或 `OPENROUTER_API_KEY` 環境變數，模型保持 `typesafe/jev-1.13`。金鑰不寫進產生的 MCP 設定，也不傳給原生 Windows worker。`doctor`、`list`、`observe`、`screenshot` 及 dry-run 不呼叫雲端；只有 `windows_review` 會呼叫付費 API。

Pi 用 `node windows/install.mjs pi` 安裝獨立原生 Extension 與 Skill，然後 `/reload` 或重開工作階段。較舊 Pi 需要 `@sinclair/typebox` 時加 `--legacy`。已安裝時加 `--force` 先備份後更新。兩個專案原有 Pi reviewer 擴充仍可共存，但不要重複載入 Windows 擴充。

其他 MCP host 以 `node windows/cli.mjs mcp` 啟動。SDK 模組可 `import { WindowsSession } from './windows/desktop.mjs'` 並呼叫同名工具。單次 CLI `observe` 只用於診斷，程序結束即失效；正式 review/execute 要用同一個長存 MCP/Pi session。

## 工具與功能

| 工具 | 功能 |
|---|---|
| `windows_info` | 平台、互動桌面與後端診斷 |
| `windows_list` | 可見、非最小化的頂層視窗 |
| `windows_observe` | 指定 HWND 的 UIA 元件、值、狀態、座標及快照 |
| `windows_screenshot` | 前景視窗可見區域 PNG，作為 MCP image 回給主 Agent |
| `windows_review` | 對快照與一個精確動作進行 Jev 二元審查 |
| `windows_execute` | 預設 dry-run；明確指定 `dryRun:false` 加 matching reviewId 才真實執行一次 |
| `windows_stop` | 終止 worker、清除快照及核准；已送出的動作不會被撤銷 |

支援點擊、UIA Invoke、設定文字、Unicode 輸入、有限按鍵組合、ScrollPattern、Toggle、Select、視窗聚焦、等待，以及有截圖雜湊驗證的座標點擊／拖曳。參數見 [ACTIONS.md](ACTIONS.md)。

UIA 搜尋限定目標視窗，最多遍歷 300 個節點，輸出最多 60 個元素；不遍歷整台電腦的所有後代。超出會標示 `truncated`，不假裝內容完整。沒有文字控制項時先看截圖，不自動啟動 OCR，也不聲稱實作 RapidOCR／OmniParser。

## 安全、限制及實際適用範圍

審查記錄和快照最多 60 秒；真實執行前在原生 worker 重新核對 UIA fingerprint、目標與視窗身分。核准綁定精確動作和完整參數，不能更換文字／按鍵／座標。真實執行的嘗試會消耗快照與核准；失敗可能回覆 `executed:"unknown"`，需重新觀察，不能盲目重播。

聚焦是明確動作，不在 `observe` 或 `screenshot` 偷偷發生。鍵盤／滑鼠操作要求前景視窗相同；控制項必須啟用、非密碼欄位且非 offscreen。DPI 使用實體螢幕座標，支援負的多螢幕原點；圖像預覽縮放比例不能直接當桌面座標。截圖是目前可见畫面裁切，不是穿透遮擋的背景視窗擷取，疊加視窗亦可能出現在圖片中。座標操作會檢查當前像素雜湊，動畫或閃爍可能使其保守拒絕。

不支援安全桌面、鎖定登入畫面、Windows 服務的非互動 session，亦不繞過 UAC／UIPI。不要為了通過而關閉 UAC 或自動提權。主程序只使用本次 PowerShell 子程序的 `-ExecutionPolicy Bypass`，**不修改**使用者／機器執行原則；WDAC、AppLocker 或群組原則阻擋時仍須由管理者按組織政策處理。一般桌面 App 的支援程度取決於其 UIA 提供者；Chrome 的 UIA 不等於 DOM、Shadow DOM 或 iframe 專用 API。

`hostChecks` 是主 Agent 的聲明，不是可靠的人工授權證明。本介面對自身 `windows_execute` 要求審查，但它不是 OS sandbox，也無法防止有 shell／其他桌面工具的宿主绕过程式。低階 `WindowsBridge` 僅供可信本地程式／測試使用，不把它暴露給模型作為繞過審查的捷徑。前景及狀態檢查不能完全消除檢查與執行間的競態；重要操作仍須主 Agent 逐步核驗。

## 測試

```powershell
npm run windows:test
```

測試含跨平台 mock/JSON-RPC、Windows 原生 C# 編譯，以及隔離的 WinForms 測試視窗：UIA 讀取、繁體中文 ValuePattern 寫入、按鈕 Invoke、截圖與舊快照拒絕。**Windows 原生測試會建立自己的可見測試視窗，但不操作其他 App、不呼叫付費 API。** 沒有互動桌面時會明確 skip GUI 測試，不假稱成功。Linux/macOS 只跑 mock，原生兩項會 skip。CI 結果以實際 job/log 為準；隔離視窗成功不等於所有 App、DPI、顯示卡與宿主已端到端驗收。

## 官方實作依據（2026-09-20 查核）

- Microsoft UIA threading：https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-threading-issues
- UIA 元素與搜尋範圍：https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/obtaining-ui-automation-elements
- 實體座標／DPI：https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-and-screen-scaling
- SendInput／UIPI：https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput
- OpenCode local MCP：https://opencode.ai/docs/mcp-servers/
- Codex MCP：https://developers.openai.com/codex/mcp
