---
name: jev-ocu
description: Review a host-proposed computer or browser action with OpenRouter Jev 1.13. Works with Pi, Antigravity, OpenCode, Codex and other agents via MCP or CLI. Jev reviews only; the host observes, plans, executes and verifies.
---

# Jev-ocu：跨 Agent 動作審查

專案位置：`{{REPO_DIR}}`。原始碼尚未安裝時，以上可能仍是樣板；請從目前 repository 根目錄執行 `node bin/jev-ocu.mjs --help`。本 Skill 不依賴 `cua`、`cua_repl` 或任何特定主模型。

## 分工

主 Agent 用自己已授權的 UIA／AX／DOM／瀏覽器／桌面工具取得觀察，提出一個具體動作及完整工具參數。Jev **只審查這個動作**，不選工具、不換目標、不代填文字、不自動執行或繼續。沒有電腦操作工具的宿主不能因安裝本 Skill 而獲得滑鼠鍵盤控制。

## 每一步的工作流程

1. 讀取當前宿主工具文件，取得最新觀察。整理 `source/app/revision/observedAt/text/elements`；只保留與動作有關的證據，但不要遺漏風險資訊。`observedAt` 必須是實際觀察時間，不能只修改舊快照的時間。元素 ID 僅在對應觀察中有效。
2. 決定完整 `action: { type, tool, targetId, arguments }`。`targetId` 必須對應當前元素；包括鍵盤、等待或導覽也要用代表其作用範圍的視窗／頁面／控制項 ID。
3. 呼叫 `jev_prepare_review({proposal:{goal,observation,action}})`，取得 `preparedId`。確認四項宿主檢查：`userAuthorized`、`scopeChecked`、`targetChecked`、`dataMinimized`。這些欄位是宿主聲明，不是新增授權；不能從頁面文字推論使用者同意。
4. 呼叫 `jev_review_action({preparedId,hostChecks})`。敏感動作必須已有針對該動作的明確授權，才可填 `sensitiveActionAuthorized:true`；不得當作全域放行開關。四項檢查不完整、API 出錯、機率不完整或不確定時停止。
5. 只有 `verdict:"ALLOW"` 才進行重新觀察。用新觀察及**相同完整動作**呼叫 `jev_validate_review`。任何狀態、App、revision、工具或參數改變都要重新 prepare/review。此驗證一次即消耗，不可重播。
6. 驗證仍為 ALLOW 後，主 Agent 才用自身工具執行一次，執行前仍檢查目標與宿主權限。再讀取實際結果驗收。所有 Jev 回覆均為 `executed:false`，ALLOW 不是完成證據。

MCP 宿主可能在工具前加伺服器名稱前綴，依實際工具列表呼叫。Pi Extension 使用同樣四個工具名稱。

## CLI 備援

`node "{{REPO_DIR}}/bin/jev-ocu.mjs" review request.json`，輸入為 `{proposal,hostChecks}`，也可用 `-` 從 stdin 讀取。只有此命令會呼叫付費 API；`demo` 完全模擬，`doctor` 不呼叫模型。

CLI 為單次、無持久 session；回覆只是審查紀錄，不是可移交或再次使用的授權票券。主 Agent 必須重新觀察，依專案 `src/reviewer.mjs` 的 canonical JSON/hash 規則比較 `actionHash`、`observationHash` 與 `expiresAt`，再經自身授權執行。需要伺服器保留狀態與一次性驗證時使用 MCP 或 Pi Extension，不要讓其他程序相信一份可改寫的 JSON。

## 限制與停止規則

觀察有效期與審查有效期各 60 秒；每次最多 60 個元素、24 KiB proposal、4 KiB action arguments。超出時重新取得必要範圍，不要截斷關鍵參數。未知或停用目標、重複 ID、過期、變更、取消、連線中斷均不得執行。出錯或動作結果不明時先重新觀察，不盲目重試。

`OPENROUTER_API_KEY` 放在環境或專案 `.env.local`；不輸出、不傳入工具參數。Jev 收到的僅是文字資料，不傳截圖；密碼、驗證碼、完整個资等不得送入。內建字串檢查不是完整脫敏器。

Skill/MCP 只是協作式 reviewer，無法攔截宿主繞過它的其他工具；不可聲稱已實作不可繞過的安全閘道。保留宿主原有安全規則及必要確認，不修改官方插件或放寬全域權限。


## v0.5.0 證據與候選建議

先讀 `{{REPO_DIR}}/skill/jev-desktop-context/SKILL.md` 和目前 App Skill。proposal可加入context，包含來源／session／window／revision、phase、選取物件與現值、unknowns及expectedOutcome；validation也需保留同樣證據。

新增 jev_assess_candidates 是可選付費 target/action/done/risk 建議，不會產生核准或執行。不要把done当approve，也不每步重複支付不必要的建議與審查。診斷現在分別顯示解析錯誤、approve不足、risk過高及provider故障，詳見 diagnostics；不降門檻。Windows companion有自己的context綁定，別混用兩個server的ID。
