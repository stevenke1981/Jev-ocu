# 給 Jev 的結構化 context

本格式由 Jev-ocu v0.5.0 的 schema 實際接受，並非只寫在提示詞的假欄位。

```js
// observation 來自剛讀取的真實工具；其餘變數由 GPT 看實際畫面取得。
const context = {
  backend: 'official-sky',
  sessionId: hostSessionId,
  windowId: String(actualWindow.id),
  revision: observation.revision,
  observedAt: observation.observedAt,
  phase: 'edit-selected-clip',
  expectedOutcome: '同一片段的 duration 欄位顯示使用者要求的值；後方片段沒有非預期移動',
  facts: [
    { name: 'selected_clip', value: actualClipName, source: 'accessibility', reference: actualClipElementId },
    { name: 'requested_duration', value: requestedDurationWithUnit, source: 'user_requirement', reference: 'current-task' }
  ],
  unknowns: actualUnknowns,
  constraints: ['只修改目前已授權的片段，不更動其他軌道']
};
```

上例變數不是已取得的觀察。若 UIA 沒有 clip，就不能建立第一筆 accessibility fact。改用主 Agent 真正看過的 screenshot，並提供 `screenshot:{imageHash,coordinateSpace,bounds:{x,y,width,height}}`、source=`host_screenshot` 的 fact，以及需要時 `visualTargets:[{label,role,box:{x,y,width,height},imageHash}]`。

Windows native 路徑的 screenshot metadata 必須與同一 `windows_screenshot` 回覆一致。image origin 加 width/height 成為 bounds；座標使用 physical-screen-pixels，不能拿顯示在聊天中的縮小圖片像素直接點擊。座標動作的起點／拖曳終點須有 visualTargets 範圍；模型仍可能因資訊不足拒絕。

通用 reviewer 的 screenshot 是宿主聲明，沒有獨立擷取驗證。`context.revision/observedAt` 必須吻合 observation。`jev_validate_review` 需要最新 observation 和相同內容的 context；允許最新 observedAt，但 phase、facts、backend/session/window、hash 改變都使核准失效。重新觀察若 hash 或元件不同，就重新 prepare/review。

## 官方 sky 唯讀 helper

在真正官方工具 runtime 初始化並閱讀文件後：

```js
const adapter = await import(repoFileUrl('src/adapters/official-sky.mjs'));
const observed = await adapter.observeOfficialWindows(sky, {
  appName: actualAppName, windowId: actualWindowId, sessionId: hostSessionId,
  goal: currentGoal, preserveIds: actualImportantElementIds
});
// observed.observation 可供 reviewer；observed.binding 可作為 context 身分欄位。
// 本 helper 只有 list_apps/get_window_state，不點擊、不改焦點。
```

`repoFileUrl` 是示意的本機 pathToFileURL，須自行以真實專案位置構造，不是本專案的函式。helper 的方法形狀沿用 Jev-cu 的已知介面，當次官方文件優先，無法使用時不切換後端。

## OCU 文字樹匯入

用同一個已選定的 OCU MCP session 取得 `get_app_state`，取其中真正的 indexed tree **文字部分**傳 `fromIndexedTree`。接受 `0 button ...` 或 `[0] button ...`；保留原始索引，拒絕重複 ID，不從 document_text 或截圖描述捏造節點。`backend:'open-computer-use'`、app/session/window 必須明確指定，observedAt 是該次讀取完成時間。

較長頁面可按 OCU 文件調整 text_limit／max_tree_nodes／max_tree_depth，再重新觀察；不是直接把全部資料送模型。匯入 helper 按目標及角色選最多40筆，可 preserveIds；回報 omittedElements。傳回的 revision 綁定完整輸入樹及來源身分，但本地只回傳選用元素，不傳整棵樹。

只有視窗沒有工具列：擴大觀察仍看不到時，保留「只有視窗」的事實，GPT 用同一已授權後端讀畫面；不要把畫面按鈕塞進 elements 假造 ID。

## 預算與狀態

一個 context 最多24個facts、8項unknowns、10條constraints、6筆已完成步驟與8個visualTargets，最多12,000 bytes；proposal 仍最多24 KiB。超量會拒絕，不能截斷 action.arguments 或省略風險來擠進預算。只送當前決策所需資料，比盲目增加token更有用；未測量前不宣稱準確率提高幾成。
