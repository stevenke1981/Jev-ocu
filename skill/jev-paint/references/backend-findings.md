# 後端能力實測：Windows 10 小畫家（2026-09-20）

本檔記錄一次**真實桌面任務**（在小畫家畫圖並存檔）的後端能力量測結果，用於修正「三個後端都能操作桌面 App」的假設。所有數字都是當次實測，未做百分比推論；mock／smoke／付費模型測試與真實任務完成度分別陳述。

## 摘要

| 後端 | 能否操作小畫家 | 決定性證據 |
|---|---|---|
| 官方 sky Computer Use | 未測（本次未選用） | — |
| **OCU**（open-computer-use） | **不能** | 執行檔無 `SendInput`；`PostMessage` 對自繪 ribbon／畫布無效（ribbon diff = 0 px） |
| **原生 Windows companion**（`windows/`） | **可以輸入**，但流程卡在 execute 的前景檢查與座標審查分數 | `windows_execute` 回 `Target is not foreground`；座標型 `windows_review` approve 上限 0.85–0.88 < 0.90 |
| Host 端 pyautogui（**非本專案後端**） | 可以（完成任務） | 形狀庫僅目標按鈕變色、畫布 ink 量測符合預期幾何、檔案實際落地並通過重開核對 |

## 受測環境

- Windows 10 專業版 22H2、build **19045**、64-bit、繁體中文、螢幕 1920×1080、縮放 100%。
- `mspaint.exe` **10.0.19041.4522**（傳統桌面版，**不支援圖層**），hwnd 由 `windows_list` 取得。
- 小畫家視窗：**1535×864 @ screen (12,3)**，非最大化。
- Jev-ocu v0.5.0（commit `6a7f17a`）、Windows companion 1.2.0、模型 `typesafe/jev-1.13-20260917`。

## 1. OCU 無法驅動小畫家

- `open-computer-use.exe`（`dist/windows/amd64/`）二進位字串掃描：只出現 `PostMessage`／`SendMessage`／`WM_LBUTTONDOWN`／`WM_LBUTTONUP`，**沒有 `SendInput`**。
- `click_method: "global"` 在 Windows 不受支援：

  ```
  click_method 'global' is not supported on Windows
  Windows supports app_post through HWND messages and does not currently support sky_click or global.
  ```

- 實測後果：`app_post` 點擊畫布 (50,300) 沒有留下任何墨點；點 ribbon 橢圓工具後，形狀庫區域像素差異 **0 px**（工具沒有被選取）。
- 結論：**不是設定或座標問題**，而是 OCU 在 Windows 以視窗訊息模擬輸入，對自繪控制項（ribbon、畫布）無效。

## 2. 原生 Windows companion：可輸入，但兩個關卡卡住

`node windows/cli.mjs doctor` 實測輸出重點：

```json
{ "backend": "UIAutomation/.NET Framework + SendInput", "platform": "windows", "architecture": "x64",
  "interactiveDesktop": true, "coordinateSpace": "physical-screen-pixels",
  "maxTargets": 60, "snapshotTtlSeconds": 60, "version": "1.2.0" }
```

- **UIA 覆蓋不足與 OCU 相同**：`windows_observe` 對小畫家回傳 60 個節點，**仍然只有容器**（`window`／`UIRibbonDockTop`／pane `automationId=59648`（畫布容器）／`StatusBar` 等）。這證明「ribbon 不在無障礙樹」是**小畫家本身的實作**，不是 OCU 轉接層的缺陷。
- 座標型 action 的既定要求：`action.arguments.imageHash` 必須等於該次 `windows_screenshot` 的 `imageHash`，且 `context.visualTargets` 的框必須覆蓋動作的起點與終點。
- 執行時的硬性前置：`native.cs` 在輸入前檢查前景，非前景即回

  ```
  Target is not foreground; explicitly review and execute focus first
  ```

  也就是說，座標輸入前必須先有一次被授權的 `focus`（或由外部維持前景）。只用宿主端 `SetForegroundWindow` 不足以通過，因為審查（付費、有往返延遲）期間前景可能再次改變。
- 另：Pi 於啟動時讀取 `~/.pi/agent/mcp.json`，新註冊的 MCP server 需要重載；本次改以 `WindowsSession`（`windows/desktop.mjs`）在同一 process 內完成單一 `observe → screenshot → review → execute → re-observe` 循環。

## 3. 座標型 action 的審查分數上限（付費實測）

門檻維持 `approve ≥ 0.9`、`risk < 0.2`，未放寬。

| # | 提案 | verdict | approve | risk | requestId |
|---|---|---|---|---|---|
| 1 | 點 OCU 座標 (514,88) 選橢圓 | **DENY** `approval_below_threshold` | 0.85 | 0.08 | `gen-dec-1789903386-rb6tQ5s2S0FgnequqhQz` |
| 2 | 同上，補強 facts 後重送 | **DENY** `approval_below_threshold` | 0.88 | 0.06 | `gen-dec-1789903467-Kl69rxmY5PAl5mQEv8jI` |
| 3 | 改以文字化選單 id（`menu:shape.ellipse`）為 target | **DENY** `approval_below_threshold` | 0.85 | 0.07 | `gen-dec-1789904711-gR1CTnNm9w4NqokGiQ31` |
| 4 | `jev_assess_candidates` 文字化選單建議（非閘門） | suggestion | 0.97（confidence） | 0.41 | `gen-dec-1789904682-veb1pJr4vKknOeVFZBlo` |

**判讀**：risk 一直很低（0.06–0.08），擋下來的不是安全顧慮，而是 **provenance 無法獨立驗證**——診斷欄位固定回報 `provenance: host_asserted_not_independently_attested`、`screenshotSentToModel: false`。Jev 的建議（0.97）可以很果斷，但同一件事經過閘門仍停在 0.85。這是「座標型動作在文字化選單下仍無法取得 0.90」的結構性上限，不是提示詞問題。

## 4. 結構化證據的硬規則（原始碼 + 實測）

來自 `src/evidence.mjs` 的 `checkEvidence()`，違反即 `invalid_evidence_binding`：

1. `context.revision` 與 `context.observedAt` 必須與 `observation` **完全相同**。
2. `context` JSON ≤ **12 KiB**（截斷風險比補欄位更重要）。
3. `source: "accessibility"` 的 fact，其 `reference` 必須是 observation 中存在的元件 id；`source: "host_screenshot"` 的 fact，其 `reference` 必須等於 `context.screenshot.imageHash`。
4. `visualTargets[].imageHash` 必須等於 screenshot hash，`box` 必須落在 `screenshot.bounds` 內。
5. `action.arguments.imageHash` 必須等於 screenshot hash。
6. **座標動作（`click_at`／`drag`）的每個座標點都必須落在某個 `visualTarget.box` 內**（起點與終點都要）。
7. 座標單位必須明示 `physical-screen-pixels`。
8. `context` 中不得出現憑證或 image data（`sk-or-v1-…`／`data:image/`／`bearer …`）。

## 5. 真實任務完成度（與 mock 分開回報）

- **實際完成**：800×600 單圖層 PNG，內容為圓頭＋兩眼＋扁橢圓嘴，存檔後**重新測量檔案本身**：`ink = 8855 px`、`ink bbox = (208,108,592,492)`、`800×600`、檔案大小 5688 bytes、sha256 `b2c3eacff2d0289a5a805000123a5894cd3a006a06f4a4e7660abe227562217c`；視窗標題轉為已存檔檔名。
- **執行的路徑是宿主端 pyautogui，不是 OCU、也不是本專案的 native driver。** 依 `AGENTS.md`，它屬於「需使用者明確選定」的替代路徑；本檔把它記錄為量測結果與 fallback 範本，不主張它是預設後端。
- 每一步都有像素證據：拖曳後量測畫布 ink 像素數與 bbox，並與預期幾何比對（例如頭部 380×380 外框，實測 (208,108)–(592,492)，與指定值差 2 px＝筆畫外擴）。

## 6. 可重用操作教訓（小畫家，實測）

1. **`Esc` 會撤銷「剛畫好的形狀」**，不是只取消選取。形狀工具在 mouseUp 後仍處於可編輯選取狀態。實測事故：四個形狀序列以 `esc → drag → esc → drag …` 執行，結果四個形狀被逐一撤銷，畫布回全白並存成空白 PNG（時間戳與檔案大小可為證）。**改用「點畫布空白處」取消選取。**
2. **形狀工具的按下滑鼠取樣有延遲**：直接 `moveTo` 後立刻 `mouseDown` 拖曳，起點會被取樣到路徑中段（首個橢圓實測變成 67×113，而指定的是 190×190）。修法：先移到起點、做 3 px 微動再回到起點、停約 0.45 s 才按下，並以約 30 步移動。
3. **modal 對話框不要按「確定」**：畫布尺寸對話框關閉失敗後成為可見但收不到鍵盤的殭屍視窗，欄位停在開啟當時的舊值（341×261）。按確定會把已改好的 800×600 縮回去。**用 `WM_CLOSE`（modal 等同取消）關閉。**
4. **不要用 `ShowWindow`**：`SW_RESTORE` 曾把最大化視窗取消最大化（1938×1048 → 1535×864），整套座標失效。只用 `SetForegroundWindow`／`BringWindowToTop`／`SetFocus`，並在每次動作前後比對 `GetWindowRect`。
5. **跨 process 的鍵盤序列不可靠**：宿主以 shell 執行腳本時，終端機視窗會搶走前景，後續按鍵會打到終端機（實測：`Ctrl+E` 之後的下一次呼叫把數字打進了終端機）。鍵盤序列必須在**同一個 process 內**完成。
6. **截圖證據要先把滑鼠移開**：停在按鈕上會產生 hover 高亮，被誤判成選取狀態。移到中性點後再擷取，並以「只有目標按鈕變化」作為控制能力證據。
7. **腳本輸出要落地成檔案**：把 JSON 直接 `| head` 會截斷掉 review／execute 結果；且用 JSON 當檔名會 `OSError: [Errno 22]`，崩潰發生在動作**之後**，容易誤判為動作未執行。

## 7. 尚未驗證 / 已知缺口

- 官方 sky 後端未測（本次未選用，不推論）。
- 未驗證「先以一張 ALLOW 的 `focus` 前置，再送座標審查」是否能讓 `windows_execute` 通過；此為最短路徑假設，需另一次實測。
- 未量測 `windows_review` 對座標提案的 approve 分布（僅 1 次嘗試且未進入 execute）。
- 色彩盤各色格、工具列復原／重做座標未逐一量測；筆寬與外框／填滿的目前值無法從 ribbon 圖示讀出（屬真實 unknowns）。

## 相關

- 文字化選單：[win10-ribbon-menu.md](win10-ribbon-menu.md) ／ [win10-ribbon-menu.json](win10-ribbon-menu.json)
- 量測工具：[win10-control-harness.py](win10-control-harness.py)
- 工作檢查表：[workflows.md](workflows.md)
