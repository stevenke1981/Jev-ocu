import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { WindowsBridge, WindowsSession } from './desktop.mjs';
const win = process.platform === 'win32';
test('native Windows backend compiles and responds (no cloud)', { skip: !win, timeout: 60000 }, async t => {
  const b = new WindowsBridge(); t.after(() => b.close()); const r = await b.call('info');
  assert.equal(r.platform, 'windows'); assert.equal(r.coordinateSpace, 'physical-screen-pixels');
});
test('isolated WinForms UIA smoke: observe, set value, invoke, screenshot and stale guard', { skip: !win, timeout: 90000 }, async t => {
  const bridge = new WindowsBridge(); t.after(() => bridge.close()); const info = await bridge.call('info');
  if (!info.interactiveDesktop) { t.skip('No unlocked interactive desktop; compile test still ran.'); return; }
  const title = 'Jev smoke ' + process.pid + '-' + Date.now();
  const child = spawn('powershell.exe', ['-NoLogo','-NoProfile','-NonInteractive','-Sta','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./smoke-target.ps1',import.meta.url)),'-Title',title], { windowsHide: true, stdio:'ignore' });
  t.after(() => child.kill());
  let hwnd;
  for(let i=0;i<40;i++) { const r = await bridge.call('list'); hwnd = r.windows.find(w => w.title === title)?.hwnd; if(hwnd)break; await delay(250); }
  assert.ok(hwnd, 'WinForms test window must exist');
  const session = new WindowsSession({bridge, askImpl: async () => ({answers:{approve:{noul:0.99},risk:{noul:0.01}},model:'MOCK-NO-NETWORK'})}); t.after(() => session.close());
  const observe = () => session.call('windows_observe',{hwnd});
  async function act(s,a) {
    const r = await session.call('windows_review',{snapshotId:s.snapshotId,goal:'Operate only this isolated test fixture',action:a,hostChecks:{userAuthorized:true,scopeChecked:true,targetChecked:true,dataMinimized:true}});
    assert.equal(r.allowed,true);
    const done = await session.call('windows_execute',{snapshotId:s.snapshotId,action:a,dryRun:false,reviewId:r.reviewId});
    assert.equal(done.executed,true,JSON.stringify(done));
    await delay(150);
  }
  let s = await observe();
  if (!s.foreground) { await act(s,{type:'focus',targetId:'window',arguments:{}}); s = await observe(); }
  const edit = s.elements.find(e=>e.automationId==='JevSmokeEdit'||e.role==='text field'); assert.ok(edit);
  await act(s,{type:'set_value',targetId:edit.id,arguments:{text:'Jev 繁體中文 123'}});
  s=await observe(); assert.ok(s.elements.some(e=>e.label.includes('繁體中文 123')));
  const button = s.elements.find(e=>e.label==='Increment'); assert.ok(button);
  await act(s,{type:'invoke',targetId:button.id,arguments:{}});
  s=await observe(); assert.ok(s.elements.some(e=>e.label.includes('Counter 1')));
  const img=await session.call('windows_screenshot',{snapshotId:s.snapshotId});
  assert.equal(img.mimeType,'image/png'); assert.equal(img.imageHash.length,64); assert.ok(img.width>0);
  // Native layer refuses an old snapshot after an external state change, independent of Jev.
  const old=await bridge.call('observe',{hwnd});
  const fresh=await bridge.call('observe',{hwnd});
  await bridge.call('execute',{snapshotId:fresh.snapshotId,action:{type:'set_value',targetId:edit.id,arguments:{text:'changed'}},execute:true});
  await assert.rejects(bridge.call('execute',{snapshotId:old.snapshotId,action:{type:'invoke',targetId:button.id,arguments:{}},execute:true}),/changed/);
});
