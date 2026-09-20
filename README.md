# Jev-ocu v0.5.0

**GPT／主 Agent 掌握操作；Jev 有足夠、可追溯來源的資料才判斷。** 本版參考 Open Computer Use 的索引、觀察預算、明確後端設計，以及 Jev-cu 的官方 Windows sky 介面與分段執行流程，改善 Jev-ocu 而不改動兩個來源專案。

不是將 OCU 整套複製成新執行器，也不讓 Jev 自主點擊。原有 reviewer、MCP、CLI、Pi 與選用 native Windows 保留。新增功能與來源固定版本見 [REFERENCE-REVIEW.md](docs/REFERENCE-REVIEW.md)。

## 這版主要變更

| 功能 | 實作 |
|---|---|
| 結構化證據 | proposal.context / windows_review.context；標記 backend/session/window/revision、phase、選取物件、數值、來源、unknowns、預期結果 |
| 拒絕診斷 | 分開缺欄位／格式、approve不足、risk過高；回傳分數、門檻、HTTP狀態與requestId；不顯示原始私密錯誤 |
| Jev 四問建議 | 選用 jev_assess_candidates，回 target/action/done/risk；只是建議，絕不產生執行核准 |
| 官方 sky 唯讀轉接 | observeOfficialWindows 只呼叫 list_apps/get_window_state；保留來源索引，不點擊、不改焦點 |
| OCU 文字樹匯入 | fromIndexedTree 接受已取得的真實 indexed tree；顯式來源、保留ID、選取預算與遺漏數 |
| App Skills | 小畫家、DaVinci Resolve、CapCut，加共用證據Skill；可一次安裝，更新備份位於探索範圍之外 |
| Windows companion 1.2.0 | 舊 native driver 保留；座標審查需與本次截圖綁定的結構化視覺證據，GPT另次執行 |

## 操作分工

```text
主 Agent 選定一個後端並取得最新觀察
      ↓
整理 source-labelled context：實際值／選取物件／不確定處／目標
      ↓
可選：Jev 四問候選建議（沒有核准、沒有執行）
      ↓
主 Agent 提出完整 action → Jev review → 主 Agent 檢視結果
      ↓
重新核對目前狀態／一次性核准 → 主 Agent 另次呼叫執行
      ↓
新觀察／預覽／成品重播 → 驗收或停止
```

已在 Codex 桌面版 Windows 11 用官方 Computer Use 工作時，繼續用同一個 GPT 和官方後端。不因讀不到按鈕、拒絕或權限錯誤就切成 OCU／自製 Windows driver。OCU 是選用、需明確選定的第三方後端，不是假冒官方工具。介面相容性以當次工具文件和真實授權為準。

## 取得與檢查

Node.js 22+，核心無第三方 npm 依賴。

```powershell
git clone https://github.com/stevenke1981/Jev-ocu.git
cd Jev-ocu
npm test
npm run doctor
npm run demo
```

已有 clone 時，保存本地修改、確認 main 後再 `git pull --ff-only origin main`。`demo` 完全模擬，不代表真實桌面或模型驗收。`doctor` 不呼叫模型，keyConfigured只是讀得到設定，不代表key有效。

OpenRouter 仍固定 `typesafe/jev-1.13`、`POST https://openrouter.ai/api/alpha/decisions`、`state/questions` 格式。在專案 `.env.local` 設定 `OPENROUTER_API_KEY`，或使用同名程序環境；程序環境优先，亦可用 `JEV_ENV_FILE` 指定檔案。不要把key填進Skill、工具參數或Git。

## 安裝三個 App Skill

```powershell
# Codex／ChatGPT 桌面版目前使用的本機 skills 目錄
node bin/jev-ocu.mjs install-app-skills codex
# 更新時先備份再替換
node bin/jev-ocu.mjs install-app-skills codex --force
# 查看技能名稱
node bin/jev-ocu.mjs skills
```

安裝 `jev-desktop-context`、`jev-paint`、`jev-davinci-resolve`、`jev-capcut` 到 `~/.agents/skills/`。備份在 `~/.jev-ocu/skill-backups/`，不讓舊技能被重新探索。可指定 `--workspace PATH` 或把 codex 改為 pi／agy／agy-cli／opencode／claude／generic。只安裝Skill，不更改key、MCP設定、官方插件或桌面權限；重新載入／開新會話生效。

| Skill | 內容 |
|---|---|
| jev-paint | 畫布尺寸、工具、筆寬、色彩、圖層、形狀、文字、裁切／縮放、透明／另存與重開驗收 |
| jev-davinci-resolve | Media Pool、timeline與fps、trim／ripple、Inspector關鍵幀、轉場handles、音訊、字幕／字卡、Deliver及重播驗收 |
| jev-capcut | 桌面版面、選取片段、秒數／磁吸、平移縮放、轉場、音訊、字幕作用範圍、匯出與播放核驗 |

給 GPT 的啟動指令：

> 讀取本專案 AGENTS.md、jev-desktop-context 與目前 App 對應 Skill。你保留規劃、工具參數、操作及驗收；Jev只協助判斷。使用目前已授權的同一Computer Use後端，觀察真實元件和畫面，為每一步整理選取物件、現值、phase、來源及預期結果。先審查並檢視，再在不同工具呼叫執行一次，不自動換後端、不猜元素ID、不降低門檻。執行後讀新狀態與實際成品驗收。

## 通用 reviewer：MCP／Pi／CLI

原有四個工具保持：`jev_info`、`jev_prepare_review`、`jev_review_action`、`jev_validate_review`；新增第五個選用 `jev_assess_candidates`。只有 review 與 assess 會呼叫付費 API，先前「只有review付費」的描述在本版更新。不要每步重複做不必要的assess＋review。

```powershell
node bin/jev-ocu.mjs config codex
node bin/jev-ocu.mjs config opencode
node bin/jev-ocu.mjs install pi
node bin/jev-ocu.mjs mcp
```

將config片段合併至宿主設定，不整份覆蓋。Pi原生Extension自動註冊新工具。CLI `review request.json` 的輸入仍是 `{proposal,hostChecks}`，proposal可加context；CLI無持久session，其JSON不能當可重播核准票券。詳細見 [整合](docs/INTEGRATIONS.md) 與 [證據格式](skill/jev-desktop-context/references/context.md)。

通用 context 是宿主聲明，不是獨立的畫面認證。提供context的提案在validate時必須帶同樣內容、最新observedAt的context；更換後端、window、phase、值、hash或省略原證據都拒絕。legacy沒有context的提案仍接受，避免破壞現有client。

## 原有 native Windows

```powershell
npm run windows:doctor
node windows/install.mjs codex
node windows/cli.mjs config codex
```

這是**另一個、需明確選定**的 `jev-windows` server，不是官方 sky。保留七個windows工具及原有UIA／截圖／單步輸入實作，仍要求reviewId與明確dryRun:false。新增的coordinate context核對session、視窗、revision、截圖metadata與目標框；截圖bytes不送Jev。使用說明見 [Windows](windows/README.md) 及 [1.2遷移](windows/UPGRADE-1.2.md)。不要把其他server的approval ID拿來執行。

## 限制與驗證

門檻保持 approve≥0.9、risk<0.2；不是提高通過率而放寬安全。Jev四問的done是完成判斷，不是approve。缺少證據、網路/API問題、解析失敗、過期與取消分開回報。hostChecks仍是呼叫端聲明，不能取代使用者授權；本專案不是OS sandbox。

原生Windows需要互動桌面，官方/OCU功能是否可用取決於當前版本、權限、作業系統與App。沒見到欄位要填unknowns；不聲稱加入Skill後就完整支援所有Resolve/CapCut版本。未量測真實任務前，不宣稱Jev準確率提高的百分比。

`npm test` 是離線模擬＋平台適用的native測試。Windows native smoke會打開自己隔離的WinForms視窗；不操作使用者App、不使用付費模型。Linux/macOS明確skip native項目。實際測試結果以本commit的CI/log為準；不把mock通過當成真正OCU、官方sky或三個桌面App端到端成功。

### Windows 10 小畫家實測（2026-09-20）

一次真實桌面任務（畫圖並存檔）量到三個與「後端可互換」假設相衝的事實，細節與雜湊見 [skill/jev-paint/references/backend-findings.md](skill/jev-paint/references/backend-findings.md)：

- **OCU 在 Windows 沒有 `SendInput`**（執行檔只有 `PostMessage`／`SendMessage`），對自繪 ribbon／畫布的點擊實測無效（差異 0 px）；`click_method: global` 回報不支援。
- **小畫家 ribbon 不在無障礙樹**：OCU 與本專案原生 .NET UIA 都只看到容器節點。座標因此只能來自宿主截圖，這也是座標型提案 approve 卡在 0.85–0.88（門檻 0.90）而 risk 僅 0.06 的原因——擋下來的是 provenance，不是安全。
- **原生 companion 的座標輸入需要前景**：`windows_execute` 回 `Target is not foreground; explicitly review and execute focus first`。最短路徑假設（先讓一次 `focus` 通過）尚未實測。
- 真實任務本身有完成，但**執行路徑是宿主端 pyautogui fallback**，不是 OCU、也不是本專案 native driver；依 `AGENTS.md` 它屬於需使用者明確選定的替代路徑，本專案不把它當預設後端。
