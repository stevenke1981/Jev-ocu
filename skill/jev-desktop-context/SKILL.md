---
name: jev-desktop-context
description: Build source-labelled evidence for Jev desktop decisions while the host GPT retains planning, execution and verification. Use before Paint, DaVinci Resolve or CapCut desktop steps; distinguish official Computer Use, Open Computer Use and native Windows sessions.
---

# 桌面證據與執行契約 · v0.5.0

專案：`{{REPO_DIR}}`。先讀當次宿主／Computer Use 文件與確認規則。GPT 是這個使用者工作流程的主 Agent；Jev 是判斷助手，不是執行代理。本 Skill 不建立 runtime，不安裝 OCU，不開啟第二個 Agent。

## 選定且固定一個操作來源

- 已在 Codex 桌面版的官方 Windows Computer Use 工作階段：繼續用真正的 `@oai/sky`。可用本專案 `src/adapters/official-sky.mjs` 的唯讀 helper；不得把 OCU 或 `windows_*` 偽裝成官方 sky。
- 使用者另行選定已連接的 OCU：用它目前提供的工具、原始 `element_index` 和同一 MCP 程序；本專案不自動啟動、下載、包裝或接管 OCU。
- 使用者明確選定本專案 native Windows server：使用 `windows_*`；其 review 與 execute 仍是兩次不同呼叫。
- 不因錯誤、拒絕、視窗找不到或權限不足而切換後端；先停下並核對。實體 Escape／使用者停止要求立即停止，不自動續跑。

## 每步證據最小集合

取得同一 session／window 的新觀察，記錄 app、語言、版本（若未看到填未知）、目前頁面／面板、被選取物件、焦點、重要數值與單位、對話框、授權範圍及下一步預期可見結果。只有與當前決策有關的資料送 Jev；不要把整份文件、整個素材庫、密碼或截圖 base64 送出。

`context.facts` 每筆都有 `name/value/source/reference`。`accessibility` 的 reference 必須是本次元件 ID；`host_screenshot` 的 reference 是對應 screenshot imageHash；`user_requirement` 指向使用者要求的段落或任務標記。視覺辨識不偽裝成無障礙元件。`unknowns` 誠實列出缺失資訊，不能用預期值代替目前值。

通用 context 綁定 `backend/sessionId/windowId/revision/observedAt`，含 `phase/expectedOutcome/facts/unknowns`；必要時加入 constraints、最近最多六筆完成紀錄和 screenshot/visualTargets。格式見 [證據與呼叫](references/context.md)。

## 決策不是執行

有多個真實候選但不確定下一步時，可選擇 `jev_assess_candidates` 問 target/action/done/risk。這是付費建議，**不產生核准或可執行提案**；不是每一步都要多付一次。不要把 done 或 target confidence 當作 approve。

通用 reviewer：主 Agent 決定完整 action → `jev_prepare_review` → 主 Agent 完成 hostChecks → `jev_review_action` → 印出、檢視結果並結束該工具呼叫 → ALLOW 才重新觀察與 `jev_validate_review` → GPT 在另一個工具呼叫用原本後端執行一次 → 新觀察驗收。

Native Windows：`windows_observe` → 必要時 `windows_screenshot` → GPT 整理 context 和完整 action → `windows_review` → 檢視結果 → GPT 另次 `windows_execute(dryRun:false)` → 再 observe 驗收。不要再重複通用 reviewer 審同一動作。

每次只執行一個已檢視的動作。不得把準備、審查和真實執行放進無人檢視的迴圈；核准後也不能改目標、數值或座標。核准失效、視窗切換、狀態變更、其他人介入時重新取得觀察，不刷新舊時間戳偽裝新資料。

## 失敗、隱私與驗收

`invalid_model_response` 是解析問題；`approval_below_threshold`、`risk_at_or_above_threshold` 是有效分數未過；兩項都未過為 `review_thresholds_not_met`。讀 diagnostics 的欄位路徑、分數、requestId、HTTP status，不降低門檻、不補通過分數、不重問直到放行。

CLI／MCP 回應是工具紀錄，不是可靠的人類授權憑證。主 Agent 的 `hostChecks` 是聲明；hash 只能綁定內容，不能證明畫面判讀正確。重要寫入仍依宿主的確認規則，沒有模糊的「全部同意」。

完成的證據是新畫面中的實際值、播放／預覽、檔名和匯出成品，不是工具回覆 OK。兩次無進展、非預期對話框、來源失聯、結果不明時停止；先觀察再決定是否重試。逾時或取消不能證明動作沒有發生。
