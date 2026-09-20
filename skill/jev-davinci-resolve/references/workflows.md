# Resolve：時間與可觀察驗收

## 幀數與時間

timecode通常是 HH:MM:SS:FF，不是小數秒。把最後欄FF当毫秒會剪錯。先確認timebase及drop-frame/non-drop-frame；29.97不直接當30做長時段換算。每個持續時間都帶單位。兩張10秒圖片加1秒轉場可能以接點handles呈現而不改總長，也可能依操作方式造成重疊；以實際timeline結果為準，不武斷保證19或20秒。

## 手動關鍵幀

記錄片段位置、clip內相對時間、timeline絕對時間、Zoom/Position起末值及aspect連結。每次點菱形要確認其狀態；已存在的keyframe再次點可能刪除它。用相同clip在開始／中段／結尾的實際畫面驗收，避免只看到一個菱形就宣稱有完整動畫。

## 字幕／字卡

先選字幕clip再修改單句，修改track style可能影響整軌；必須與需求相符。章節題字的繁體文字、行序、safe-area、可讀時間以預覽確認。輸出SRT不會自動保留字卡特效，burn-in也不能當作可編輯字幕文件。

## 可捨棄 smoke

使用專門測試專案，匯入兩張獲授權測試圖 → 各設定明確duration → 第一張加Position/Zoom關鍵幀 → 接點加指定轉場 → 一句測試字幕 → render到不覆寫的檔名 → 播放驗證。每一階段記錄本機版本、完整目標及證據。這是人工授權後的測試計畫，不代表已自動實測。

## 官方參考

https://www.blackmagicdesign.com/products/davinciresolve/edit
https://www.blackmagicdesign.com/products/davinciresolve/training

核對日期2026-09-20。官方Edit頁說明支持導入、timeline編輯、轉場和Inspector類工作；具體標籤、快捷鍵及Studio限制必須對照使用者版本，不按網站版本擅自升級軟體。
