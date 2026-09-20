---
name: jev-capcut
description: Operate the CapCut desktop editor with GPT-controlled Computer Use and Jev evidence assistance. Use for image/video/audio timelines, durations, pan/zoom keyframes, transitions, captions, titles and verified local exports; not the web editor, mobile app or draft-file scripting.
---

# CapCut 桌面 Skill · v0.5.0

先讀 `{{REPO_DIR}}/skill/jev-desktop-context/SKILL.md`。使用真正CapCut桌面版，不是網頁版／手機版；若實際是剪映，先標示不同產品、版本與語系，不能假設完全相同。官方Computer Use已可用時保持該路徑，不啟動新控制器。

## 先取得完整但精簡的狀態

記錄專案名、版本與語系、媒體區／預覽區／時間軸／右側屬性面板、frame rate及畫幅、選取clip／軌道、playhead與clip起迄、main track magnet、snapping、linkage（若版本顯示）、Inspector模式、Zoom/Position/keyframe、目前字幕樣式作用範圍。

CapCut可能只給無障礙視窗而沒有工具列或timeline細節。這不是猜按鈕編號的理由：GPT用同一後端取得截圖，實際辨認按鈕文字、區域及選取狀態，再作host_screenshot事實。雜湊是畫面綁定，不是模型自己看到了圖片。

## 工作主線

1. **專案與匯入**：確認當前專案、是否保存及輸出規格，只匯入使用者提供的素材。若媒體缺失或「代理」／下載狀態不明，先查明；不自動登入、上雲或購買素材。
2. **加入時間軸**：確認插入軌與playhead，單次放一個可觀察單位，檢查片段順序、duration及音軌連動。注意磁吸可能移動相鄰素材，不能把拖曳終點當作實際時間。
3. **靜圖秒數**：先讀選取clip及起迄，再用當前版本存在的duration欄位或剪輯控制修改。沒有數值欄就由GPT依時間軸尺標精確操作與核對；禁止憑固定像素距離推算10秒。
4. **平移／縮放keyframe**：選正確clip、在有效起始位置讀Position/Scale → 加起始keyframe → 移playhead到末端有效幀 → 改結束值。菱形狀態和clip位置要一併驗證；點同一keyframe可刪除它。播放起／中／末確認方向及裁切。
5. **轉場**：指定接點，不把單clip入場／出場動畫當成跨clip轉場。讀轉場名稱、duration和作用范围；若素材過短、需付費或會影響時長，停下確認方案。實際播放接點確認不是黑幀。
6. **音訊**：先分辨旁白、背景音樂與片段原音，調單clip或指定軌道，不誤用套用全部。核對音量、fade、mute及sync，避免只看波形有出現就說有正確聲音。
7. **字幕／文字**：先確認現有字幕或使用者字幕檔，避免重複自動辨識。Desktop是否顯示Import/SRT/TXT以當次功能為準；ASS/VTT不可假定原生支援。匯入後檢查第一／中間／最後一段與繁體字；「套用全部」必須在需求覆蓋整組樣式時才用。字幕時間與clip畫面時間分開核對。
8. **匯出與專案保存**：讀輸出名、目錄、範圍、畫幅／解析度、fps、codec及音訊設定。Pro／登入／分享提示不自動接受。匯出到不覆寫的路徑，等實際完成後重播成品檢查首尾、轉場、字幕和聲音；專案autosave與匯出影片是不同結果。

## Jev 判斷所需證據

每次goal限定一個決策，如「在當前選取clip的Basic屬性，把Scale欄設定為使用者指定值」。附phase、clip名、軌道、playhead、欄位現值／單位、keyframe狀態、相鄰片段和預期結果。UIA只有視窗時明確放進unknowns，不隱藏。

真實可存取元件用原始ID；截圖識別的選取框、剪接點和菱形用visualTargets與hash，不能轉成UIA按鈕。審查後先由GPT看結果，再另一次工具呼叫執行；模型只判斷，不拖動時間軸。

## 停止與交付

實體Escape、對話框、窗口移動／縮放、前景或所選clip改變、兩次操作無進展即停止並重新觀察。不用改draft JSON、Python腳本或FFmpeg偷偷完成本次桌面任務。

交付實際輸出檔及專案狀態，注明片長、fps、字幕模式、轉場與keyframe驗收。不得把未匯出的編輯預覽標成完整影片。详見 [時間軸檢查表](references/workflows.md)。
