---
name: jev-davinci-resolve
description: Use GPT-controlled desktop Computer Use to edit in DaVinci Resolve with source-labelled Jev evidence. Covers import, timeline, trim, still duration, Inspector keyframes, transitions, audio, subtitles, titles and verified export. No Resolve scripting API or alternate renderer.
---

# DaVinci Resolve 桌面 Skill · v0.5.0

先讀 `{{REPO_DIR}}/skill/jev-desktop-context/SKILL.md`。只操作已選定後端的真正桌面App；不以Resolve Python/Lua scripting API、專案資料庫改寫或FFmpeg取代本次GUI工作。GPT主控，Jev提供決策，不代執行。

## 專案與證據

記錄實際版本／Free或Studio、介面語言、目前頁面（Media/Cut/Edit/Fusion/Color/Fairlight/Deliver或實際顯示名稱）、專案名、時間軸名、解析度、frame rate、起始timecode、目前playhead、選取片段及軌道、Inspector焦點、鎖定／靜音／連結選取狀態。未見到即列unknowns，不把媒體來源fps当作timeline fps。

在剪輯任務優先以已確認的Edit頁工作；不硬用固定F快捷鍵，使用者可能自訂鍵盤配置。儲存既有專案或建立使用者授權的副本，改變timeline設置前確認影響。

## 工作主線

1. **匯入**：只選明確提供的素材路徑，確認Media Pool新增項目及離線媒體狀態。遇到更改專案fps詢問，不盲點接受；先對照交付規格。
2. **時間軸**：辨認source viewer和timeline viewer；確認軌道、playhead、插入／覆寫／附加模式。放入一次後核對起迄時間及clip數，不把素材選中當成已放到timeline。
3. **裁切／靜圖秒數**：先讀選取clip、duration單位、fps和連結音訊，再改值。Ripple可能移動後方素材，普通trim與ripple的預期不同。數值變更後檢查總時長和相邻接點。
4. **平移縮放**：Inspector選中正確片段後，在第一個預期時間點設定Position/Zoom與keyframe，再移到末端有效幀設定另一組值。注意最後可見幀與out邊界不同；開始／中段／結尾預覽都要確認。Dynamic Zoom和手動keyframe不是同一路徑，不互相混用。
5. **轉場**：確認相鄰兩clip及接點、有可用handles；加入指定轉場後讀duration與對齊方式。缺少handles時回報，不私自改speed、裁短clip或把畫面凍結當成功。檢查是否造成不預期黑畫面或時長改變。
6. **音訊**：辨認音軌與對應clip、電平與是否mute，調整單一目標，確認沒有誤改整軌或主輸出。淡入淡出按實際曲線與duration設定，不僅憑拖曳距離。
7. **字幕與字卡**：字幕軌、Text/Text+是不同物件；先確認需求。匯入字幕檢查encoding、語言、句數、第一／中間／最後一句時間與位置。SRT不保證保留樣式／位置；ASS/VTT依當前GUI可接受格式，不聲稱全部可直接匯入。要轉換須另按授權處理，不偷偷改原檔。
8. **輸出**：Deliver核對輸出範圍、容器／codec、解析度、fps、音訊和字幕是burn-in還是sidecar；確認檔名、目錄與覆寫影響後加queue並render。完成後重新播放輸出，核對時長、首尾、轉場和字幕。Render完成不等於畫面符合需求。

## 給 Jev 的狀態

把下一步拆成單一GUI操作。例：「在Inspector把目前選取靜圖clip的Zoom從觀察值改為指定值」，並附clip名／軌道／playhead／Zoom現值／keyframe是否啟用／expectedOutcome。不要只問「讓圖片動起來」。

時間軸上的非文字元素是host_screenshot證據，不假造AX index。只讓Jev看到當前phase需要的Inspector與clip事實，不送整個素材庫和私人完整路徑。phase或選取clip改變後重取觀察。

## 驗收與停止

每次實際動作後，GPT重新檢視，再決定下一步。遇到Offline、未儲存提示、對話框、free/studio功能限制、錯誤選取、非預期ripple、未知鍵盤焦點，先停。不要為了使用Studio功能自動購買或登入。

交付記錄：實際專案／輸出位置、timeline規格與時長、字幕模式、keyframe與轉場測試結果、是否完成render和重播。詳见 [剪輯與時間規則](references/workflows.md)。
