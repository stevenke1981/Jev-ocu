# CapCut 精確操作檢查表

## 兩張圖範例（只有使用者確定這些規格時才採用）

先在新測試專案匯入兩張已授權圖片，讀取timeline fps，明確設定每張duration；接點加入使用者指定的cross-dissolve，確認介面讀回duration。以時間軸真實起迄核對總長，不假定「10+10-1」永远等於實際專案長度。首尾keyframe的位置用clip內時間與timeline時間雙重記錄，不能把第二張的開始當第一張末端。

如果是夜燈說書且使用者沿用該集規格，可另列5秒片頭、每張10秒、1秒交叉淡化與左右平移／縮放；這些是選用的專案模板，**不是所有CapCut任務的默认值**。配音與字幕仍按實際音軌時長对齊。

## 畫面證據

- 修改duration：選中clip、左右邊界、讀回duration、相鄰clip是否位移。
- 調整Scale：所屬clip、right panel的Basic/Transform、目前值、單位、keyframe狀態。
- 插入轉場：接點是哪兩個clip、transition圖示、名稱與duration、播放接點結果。
- 調字幕位置：被選字幕、該句／全體作用範圍、safe-area與遮擋、輸出是否burn-in。
- 匯出：檔名／目錄、編碼範圍和設定、完成狀態、重播首尾及有字幕的段落。

主 Agent 根據這些清單建立source-labelled facts；不是把這段清單本身當成「已觀察到」送Jev。

## 無候選／拒絕時

先讀reason和diagnostics。解析失敗不重畫UI或降低門檻；HTTP/network錯誤不推論key一定無效。Jev分數真的不足時，看是否缺失選取clip、欄位作用範圍或時間單位，再用新畫面重規劃。即使补齐资料仍可拒絕；不得連續換措辭尋求放行。

## 官方參考

https://www.capcut.com/resource/how-to-add-keyframes-in-capcut
https://www.capcut.com/help/how-to-import-subtitles

核對日期2026-09-20；桌面版本、地區、登入及Pro功能會有差異。每次依實際菜單確認，不能把網頁版或手機版操作說明直接搬用。
