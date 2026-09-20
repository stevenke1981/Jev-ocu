# Windows action contract

Every action is `{ "type": "...", "targetId": "ID_FROM_SNAPSHOT", "arguments": {...} }`. Unknown or extra arguments are rejected. Do not pass command lines, executable paths, raw PowerShell or key-macro syntax.

| type | exact arguments | notes |
|---|---|---|
| focus | `{}` | targetId=`window`; no silent restoration of minimized windows |
| invoke | `{}` | UIA InvokePattern; does not fall back silently |
| click | `{}` | physical click on the target's verified clickable point |
| set_value | `{"text":"繁體中文"}` | writable ValuePattern, replaces value |
| type_text | `{"text":"literal {ENTER}"}` | UTF-16 Unicode SendInput; braces remain literal, no clipboard |
| press_key | `{"key":"CTRL+A"}` | CTRL/ALT/SHIFT plus one named key; no WIN or secure-attention bypass |
| scroll | `{"direction":"down","count":1}` | up/down/left/right; count 1–5; ScrollPattern required |
| toggle | `{}` | TogglePattern |
| select | `{}` | SelectionItemPattern |
| wait | `{"milliseconds":300}` | 1–2000; bounded, not an autonomous polling loop |
| click_at | `{"x":100,"y":200,"imageHash":"SHA256_FROM_SCREENSHOT"}` | targetId=`window`; physical screen coordinates |
| drag | `{"x":100,"y":200,"toX":250,"toY":300,"imageHash":"SHA256_FROM_SCREENSHOT"}` | targetId=`window`; bounded 200ms drag, endpoints and path remain in same unobscured window |

Example sequence (replace identifiers with actual results):

```json
{
  "snapshotId": "ACTUAL_SNAPSHOT_ID",
  "goal": "Click the explicitly authorized local button",
  "action": {"type":"invoke","targetId":"ACTUAL_TARGET_ID","arguments":{}},
  "hostChecks": {"userAuthorized":true,"scopeChecked":true,"targetChecked":true,"dataMinimized":true}
}
```

Send this to `windows_review`. Only after an ALLOW response, call `windows_execute` with the same snapshot/action, its actual `reviewId`, and `dryRun:false`. Host checks must be factual; the sample is not authorization. Do not serialize a provider key into any tool input. At most 2000 UTF-16 units of text are accepted per action; longer content needs deliberately planned, separately reviewed steps.
