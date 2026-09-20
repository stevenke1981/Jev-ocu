# Windows 10 小畫家 Ribbon 選單（文字化 select menu）

`win10-ribbon-menu.json` 把小畫家的按鍵／功能鍵轉成**文字描述的候選項目**，讓 review 助手（Jev）能在文字層判斷「該用哪個功能、目標是什麼」，而不是被迫驗證一個無法核對的像素座標。

## 為什麼需要這份選單

小畫家的 ribbon **完全不暴露於 UIA**：實測 `get_app_state` 在 `max_tree_depth=12`、`max_tree_nodes=500` 下仍只有 21 個容器節點（視窗／Ribbon 容器／狀態列／標題列／視窗按鈕），形狀庫、色彩盤、工具按鈕、畫布內容都沒有 node。

後果：以像素座標提案時，Jev 的 approve 分數卡在 0.85–0.88（門檻 0.90），DENY 原因是 `approval_below_threshold`。**注意 risk 只有 0.06**（上限 0.2），所以擋下的不是安全性，而是「目標無法被獨立比對」。

兩個補充量測（詳見 [backend-findings.md](backend-findings.md)）：

- **不是 OCU 轉接層的缺陷**：本專案原生 Windows companion（`UIAutomation/.NET Framework + SendInput`）對同一視窗回傳 60 個節點，**同樣只有容器**。小畫家的 ribbon 本來就不在無障礙樹裡。
- **OCU 在 Windows 無法執行座標點擊**：其執行檔沒有 `SendInput`，只有 `PostMessage`，而 ribbon／畫布是自繪控制項（實測 ribbon 差異 0 px）。因此本檔的 `ocu` 座標欄位**不是給 OCU 後端用的**；它的用途是「文字化候選清單」——讓 Jev 在文字層選出正確的**功能與目標**，實際輸入必須另選一個具備真實輸入的後端。

## 使用方式

1. 取一份新的 `get_app_state` 觀察（同一 session／window）。
2. 把本檔的 `items` 轉成 `observation.elements`，**id 保留 `menu:` 前綴**，讓它一眼可辨為 host 描述而非 UIA 節點。
3. `observation.source` 設為 `"text"`，並在 `text` 欄位說明「此為 host 依截圖量測的文字化選單，非 UIA 樹」。
4. `context.facts` 逐項標明來源：
   - 座標／畫布／外觀 → `source: "host_screenshot"`，`reference` 必須等於 `context.screenshot.imageHash`。
   - 真實 UIA 節點（`verifiedElementsFromA11y`）→ `source: "accessibility"`，`reference` 用該節點 id。
5. 送 `jev_assess_candidates` 取得 target／action／done／risk 建議，或送 `jev_prepare_review` → `jev_review_action` 取得閘門判定。

## 誠實標註規則（重要）

| confidence | 意義 | 可否直接點擊 |
|---|---|---|
| `verified` | 已用格線 + 放大十字準星目視確認命中 | 可以 |
| `derived` | 由已驗證點推導的均勻格線（欄距≈23.3px、列距≈25px），未逐一目視 | 可以，但執行前應再核對 |
| `unmeasured` | 座標未量測 | **不可以** |

座標只保證在**同一視窗幾何**下有效。實測事故：以 `ShowWindow(SW_RESTORE)` 把視窗帶回前景會取消最大化，使視窗由 1938×1048 變成 1535×864，整套座標位移。**沒有變更視窗幾何，就必須重新量測。**

## 座標系

`OCU = 視窗相對實體像素`；`screen = OCU + 視窗原點`。

驗證方法：`GetWindowRect`（DPI-aware）得到的尺寸必須與 `get_app_state` 回報的 frame 完全一致。量測時為 1535×864 @ screen (12,3)。

畫布：OCU 左上 `(14,194)`、尺寸 `341×261`、縮放 100%、**不支援圖層**。
畫布內座標換算：`OCU = 畫布左上 + 畫布內座標`。

**畫布尺寸可在任務中變更，變更後必須整套重新量測。** 用「影像內容」對話框（`Ctrl+E`，單位選像素）把畫布放大是實務上可行的第一步；量測時畫布原點 (14,194) 不變，但可用範圍變大。本檔的 341×261 是量測當下的值；同一次任務的最終輸出改用 800×600。

## 畫布尺寸的自我驗證

從畫布內任一種子點對純白 `#FFFFFF` 做四向擴張，得到的矩形寬高必須等於狀態列顯示的像素尺寸（本例 341×261）。兩者一致才代表座標系與畫布原點都正確。

## 已知限制

- `size`（筆寬／外框寬度）與 `shape.outline`／`shape.fill` 的**目前值無法從 ribbon 圖示讀出**，屬於真正的未知，不要用預期值冒充。
- `menu:shape.gallery-col6-row1` 的實際形狀名稱未經點擊確認。
- 色彩盤各色格座標未逐一量測。
- 快速存取工具列的復原／取消復原／儲存座標未量測（鍵盤 `Ctrl+Z`／`Ctrl+S` 可替代）。

## 相關

- 後端能力實測與證據硬規則：[backend-findings.md](backend-findings.md)
- 量測工具：[win10-control-harness.py](win10-control-harness.py)
