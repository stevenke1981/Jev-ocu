---
name: jev-paint
description: Operate Windows 11 Microsoft Paint through the selected desktop Computer Use backend with GPT in control and Jev evidence assistance. Use for drawing, shapes, text, crop, resize, layers, transparency and verified local saving; not image generation APIs or Paint 3D.
---

# 小畫家桌面 Skill · v0.5.0

先讀 `{{REPO_DIR}}/skill/jev-desktop-context/SKILL.md`，固定目前後端。使用者在 Codex 官方 Computer Use 已工作時保持官方路徑。GPT 執行與驗收，Jev 僅判斷。沒有其他圖片程式、Python 製圖、Image API 或背景滑鼠執行器。

## 啟動與當前狀態

從真實 app/window 清單選 Microsoft Paint／小畫家，不把 Photos 或 Paint 3D 當成 Paint。語言、版本、顯示比例以當次畫面為準；不要照抄固定座標或舊快捷鍵。

操作前取得：檔名及是否未儲存、畫布像素寬高、zoom、可見畫布範圍、目前圖層、工具、筆寬、前景／背景色、形狀填滿與外框、選取區／文字框狀態。沒有看到的欄位放 unknowns。

## 分段製作

1. 先確定輸出尺寸、內容及目標檔名。若已有未存作品，保存或另存副本後再開始；不直接清空畫布。
2. 尺寸用像素或百分比必須明確；保留長寬比選項按使用者目標設定。改畫布尺寸與縮放整張影像不是同一操作，先讀實際對話框。
3. 在有圖層功能的版本，把背景、主要圖形、文字分開；沒有該功能則回報並使用使用者接受的平面方案，不假設可以保留圖層。
4. 選工具與色彩是文字候選決策；實際畫線／畫形狀是 GPT 對畫布的視覺操作。每次拖曳前檢查畫布原點、zoom、工具與作用圖層；先小量測試，不長串無觀察繪圖。
5. 文字先確定字體、字号、顏色與文字框，再輸入。完成文字框前看繁體字和換行，避免點到外面後才發現文字已點陣化。
6. 檢查全圖構圖與局部鋸齒／填色漏出，必要時撤銷**上一個已確認**的錯誤操作；不是盲按多次 Undo。
7. 另存使用者指定的檔案，確認格式與覆寫提示。畫面看起來透明不等於輸出保留 alpha；重新開啟輸出並核對尺寸、文字、背景及色彩。需要可編輯圖層時，只有實際版本提供相應專案格式才承諾保留。

## Jev 的必要證據

phase 應具体，如 `select-rectangle`、`resize-canvas`、`save-png`；不要只有「幫我畫圖」。facts 包含目前工具／填色／尺寸與對應來源；選取區／圖層選中狀態比「圖層按钮存在」更重要。expectedOutcome 描述新值或圖形位置，不是「點击成功」。

輸入格的值和按鈕的文字可引用原始元件ID。畫布上的線條、矩形、文字內容通常需 host_screenshot；不能建立虛構 button ID。若 API 只回視窗，回報候選不足，先看圖補必要資訊再判斷。

## 停止與交付

實體 Escape、使用者接管、非預期全選、視窗／zoom變更、未儲存提示或操作不確定時停止。不得因為繪圖需要多筆畫就把審查和執行放在同一自動迴圈。

交付記錄：檔案實際路徑、格式、畫布尺寸、是否透明、是否另存可編輯專案、重開檔案驗收結果。未儲存就明確說未完成，不以截圖當作已交付文件。

細項见 [工作檢查表](references/workflows.md)。按鍵的文字化候選清單见 [Windows 10 ribbon 選單](references/win10-ribbon-menu.md)（機器可讀：[win10-ribbon-menu.json](references/win10-ribbon-menu.json)）；後端能力實測、證據硬規則與可重用教訓见 [後端能力實測](references/backend-findings.md)。
