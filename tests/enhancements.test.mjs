import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diagnoseReview, diagnoseError } from '../src/diagnostics.mjs';
import { ReviewSession } from '../src/reviewer.mjs';
import { WindowsSession } from '../windows/desktop.mjs';
import { fromIndexedTree } from '../src/adapters/indexed-observation.mjs';
import { observeOfficialWindows } from '../src/adapters/official-sky.mjs';
import { installAppSkills, APP_SKILLS } from '../src/app-skills.mjs';
import { ask } from '../src/openrouter.mjs';
const NOW = Date.parse('2026-09-20T09:00:00Z');
const checks = { userAuthorized:true, scopeChecked:true, targetChecked:true, dataMinimized:true };
const observation = () => ({ source:'uia', app:'Paint', revision:'r1', observedAt:new Date(NOW).toISOString(), text:'', elements:[{id:'0',role:'window',label:'Paint',enabled:true},{id:'12',role:'button',label:'矩形',enabled:true}] });
const context = () => ({ backend:'official-sky',sessionId:'session-1',windowId:'w1',revision:'r1',observedAt:new Date(NOW).toISOString(),phase:'select-shape',expectedOutcome:'矩形工具已選取',facts:[{name:'visible_tool',value:'矩形',source:'accessibility',reference:'12'}],unknowns:[] });
const action = () => ({ type:'click',tool:'official.click',targetId:'12',arguments:{element_index:12} });
const payload = () => ({goal:'Select the rectangle tool',observation:observation(),action:action(),context:context()});
const good = () => ({answers:{approve:{noul:0.95},risk:{noul:0.01}},model:'typesafe/jev-1.13',requestId:'req-test',httpStatus:200});
const session = (askImpl = async () => good()) => new ReviewSession({now:()=>NOW,askImpl});

test('diagnostics distinguish invalid schema, approval, risk and both thresholds',()=>{
  const result=(approve,risk)=>diagnoseReview({answers:{approve:{noul:approve},risk:{noul:risk}}});
  assert.equal(result(0.89,0.1).reason,'approval_below_threshold');
  assert.equal(result(0.99,0.2).reason,'risk_at_or_above_threshold');
  assert.equal(result(0.5,0.3).reason,'review_thresholds_not_met');
  assert.equal(result(0.9,0.199).allowed,true);
  for(const v of [undefined,null,'', ' ', true,'0x1','1e-1',Infinity,-1,1.01]) assert.equal(result(v,0).reason,'invalid_model_response');
  assert.equal(result('0.95','0.01').allowed,true);
  assert.equal(result(undefined,0).diagnostics.issues[0].path,'answers.approve.noul');
});
test('diagnostics never echo raw provider text or unsafe metadata',()=>{
  const r=diagnoseReview({...good(),requestId:'Bearer private-secret',model:'sk-or-v1-private',answers:{approve:{noul:'PRIVATE-DATA'},risk:{noul:0}}});
  assert.equal(r.diagnostics.requestId,null);assert.equal(r.diagnostics.model,null);
  assert.ok(!JSON.stringify(r).includes('PRIVATE-DATA'));
  assert.equal(diagnoseError({code:'provider_timeout',message:'secret'}).reason,'provider_timeout');
});
test('provider exposes request ID on success and structured HTTP error, no raw error reflection',async()=>{
  const options={state:{},questions:{},apiKey:'mock-only'};
  const r=await ask({...options,fetchImpl:async()=>new Response(JSON.stringify({...good(),id:'req-body'}),{headers:{'x-request-id':'req-header'}})});
  assert.equal(r.requestId,'req-body');assert.equal(r.httpStatus,200);
  await assert.rejects(ask({...options,fetchImpl:async()=>new Response('{"error":{"message":"PRIVATE"}}',{status:403,headers:{'x-request-id':'req-failed'}})}),e=>e.code==='provider_http_error'&&e.requestId==='req-failed'&&!e.message.includes('PRIVATE'));
});
test('generic evidence reaches Jev unchanged and is bound through final validation',async()=>{
  const s=session(async request=>{assert.deepEqual(request.state.proposal.context,context());return good();});
  const p=await s.call('jev_prepare_review',{proposal:payload()});
  const r=await s.call('jev_review_action',{preparedId:p.preparedId,hostChecks:checks});
  assert.equal(r.allowed,true);assert.equal(r.diagnostics.requestId,'req-test');
  assert.equal(r.evidence.provenance,'host_asserted_not_independently_attested');
  const v=await s.call('jev_validate_review',{preparedId:p.preparedId,observation:observation(),action:action(),context:context()});
  assert.equal(v.allowed,true);assert.equal(v.executed,false);s.close();
});
test('generic context cannot be omitted or changed at validation',async()=>{
  for(const changed of [undefined,{...context(),phase:'different'}]){
    const s=session();const p=await s.call('jev_prepare_review',{proposal:payload()});
    await s.call('jev_review_action',{preparedId:p.preparedId,hostChecks:checks});
    const v=await s.call('jev_validate_review',{preparedId:p.preparedId,observation:observation(),action:action(),...(changed?{context:changed}:{})});
    assert.equal(v.allowed,false);assert.equal(v.reason,'evidence_changed_or_missing');s.close();
  }
});
test('bad evidence ID, stale revision and unbound visual fact fail before API',async()=>{
  for(const change of [c=>c.revision='stale',c=>c.facts[0].reference='missing',c=>c.facts[0].source='host_screenshot']){
    const p=payload();change(p.context);await assert.rejects(session().call('jev_prepare_review',{proposal:p}));
  }
});
test('valid DENY retains actual scores instead of collapsing into model_denied_or_uncertain',async()=>{
  const s=session(async()=>({...good(),answers:{approve:{noul:0.3},risk:{noul:0.02}}}));
  const p=await s.call('jev_prepare_review',{proposal:payload()});const r=await s.call('jev_review_action',{preparedId:p.preparedId,hostChecks:checks});
  assert.equal(r.reason,'approval_below_threshold');assert.equal(r.diagnostics.probabilities.approve,0.3);s.close();
});
test('four-question suggestions preserve target identity and never grant permission',async()=>{
  const s=session(async({questions})=>{assert.deepEqual(Object.keys(questions),['target','action','done','risk']);return {answers:{target:{choice:'c1',confidence:0.9},action:{choice:'click'},done:{noul:0.01},risk:{noul:0.01}}};});
  const r=await s.call('jev_assess_candidates',{goal:'Select rectangle',observation:observation(),context:context()});
  assert.equal(r.status,'suggestion_only');assert.equal(r.suggestion.targetId,'12');assert.equal(r.executable,false);assert.equal(r.preparedId,undefined);s.close();
});
test('window-only observation does not invent buttons or call suggestion API',async()=>{
  const s=session(()=>assert.fail('no model'));const o=observation();o.elements=o.elements.slice(0,1);
  const r=await s.call('jev_assess_candidates',{goal:'draw',observation:o});assert.equal(r.reason,'insufficient_candidates');s.close();
});
test('indexed tree importer preserves Chinese and original IDs under an explicit budget',()=>{
  const r=fromIndexedTree({tree:'0 視窗 小畫家\n12 按鈕 矩形\n15 按鈕 儲存 已停用\n19 文字 800 × 600',app:'Paint',backend:'official-sky',sessionId:'s',windowId:'w',observedAt:new Date(NOW).toISOString(),maxElements:2,preserveIds:['19'],goal:'矩形'});
  assert.deepEqual(r.observation.elements.map(e=>e.id),['12','19']);assert.equal(r.report.omittedElements,2);assert.equal(r.observation.elements[0].role,'button');
});
test('indexed importer rejects guessed required IDs, duplicate snapshots and absent tree',()=>{
  const base={tree:'0 button A',app:'Paint',backend:'open-computer-use',sessionId:'s',windowId:'w',observedAt:new Date(NOW).toISOString()};
  for(const options of [{...base,preserveIds:['99']},{...base,tree:'0 button A\n0 button B'},{...base,tree:'Only a picture of a button'}])assert.throws(()=>fromIndexedTree(options));
});
test('official adapter is read only and rejects ambiguous windows without fallback',async()=>{
  const calls=[];const window={app:'paint',id:42};
  const sky={target:'windows',list_apps:async()=>[{id:'paint',displayName:'小畫家',windows:[window]}],get_window_state:async args=>{calls.push(args);return {window,accessibility:{tree:'0 視窗 小畫家\n12 按鈕 矩形'}};},click:()=>assert.fail('no actions')};
  const r=await observeOfficialWindows(sky,{appName:'小畫家',sessionId:'s'});assert.equal(r.executed,false);assert.equal(calls[0].include_screenshot,false);
  await assert.rejects(observeOfficialWindows({...sky,list_apps:async()=>[{id:'paint',windows:[window,{app:'paint',id:43}]}]},{appName:'paint',sessionId:'s'}),/exact official window/);
});
function nativeFixture(){
  let calls=0, actions=0;
  const raw={snapshotId:'s1',hwnd:'42',revision:'r1',observedAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),app:'CapCut',elements:[{id:'window',role:'window',label:'CapCut',enabled:true}]};
  const image={snapshotId:'s1',imageHash:'a'.repeat(64),origin:[-400,0],width:400,height:300,coordinateSpace:'physical-screen-pixels',mimeType:'image/png',data:'NEVER-TO-JEV'};
  const bridge={close(){},async call(method){if(method==='observe')return raw;if(method==='screenshot')return image;if(method==='execute'){actions++;return {executed:true};}return {};}};
  const s=new WindowsSession({bridge,now:()=>NOW,askImpl:async request=>{calls++;assert.ok(!JSON.stringify(request).includes(image.data));return good();}});
  return {s,image,calls:()=>calls,actions:()=>actions};
}
test('native coordinate review needs bound source-labelled screenshot evidence',async()=>{
  const f=nativeFixture(),s=await f.s.call('windows_observe',{hwnd:'42'});
  const a={type:'click_at',targetId:'window',arguments:{x:-380,y:20,imageHash:f.image.imageHash}};
  const input={snapshotId:s.snapshotId,goal:'Select locally visible control',action:a,hostChecks:checks};
  assert.equal((await f.s.call('windows_review',input)).reason,'visual_evidence_required');assert.equal(f.calls(),0);
  await f.s.call('windows_screenshot',{snapshotId:s.snapshotId});
  const c={...context(),backend:'native-windows',sessionId:s.sessionId,windowId:s.hwnd,facts:[{name:'visible_button',value:'Basic',source:'host_screenshot',reference:f.image.imageHash}],screenshot:{imageHash:f.image.imageHash,coordinateSpace:'physical-screen-pixels',bounds:{x:-400,y:0,width:400,height:300}},visualTargets:[{label:'Basic',role:'button',box:{x:-395,y:5,width:40,height:40},imageHash:f.image.imageHash}]};
  assert.equal((await f.s.call('windows_review',{...input,context:{...c,windowId:'43'}})).reason,'invalid_evidence_binding');assert.equal(f.calls(),0);
  const r=await f.s.call('windows_review',{...input,context:c});assert.equal(r.allowed,true);assert.equal(f.actions(),0);
  assert.equal((await f.s.call('windows_execute',{snapshotId:s.snapshotId,action:a,reviewId:r.reviewId,dryRun:false})).executed,true);f.s.close();
});
test('native invalid scores are distinguishable from policy refusal',async()=>{
  const raw={snapshotId:'s1',hwnd:'42',revision:'r1',observedAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),app:'Paint',elements:[{id:'button',role:'button',label:'Rectangle',enabled:true}]};
  const s=new WindowsSession({bridge:{close(){},call:async()=>raw},now:()=>NOW,askImpl:async()=>({answers:{approve:{probability:0.99},risk:{noul:0}}})});
  await s.call('windows_observe',{hwnd:'42'});
  const r=await s.call('windows_review',{snapshotId:'s1',goal:'Select rectangle',action:{type:'invoke',targetId:'button',arguments:{}},hostChecks:checks});assert.equal(r.reason,'invalid_model_response');assert.equal(r.diagnostics.probabilities.approve,null);s.close();
});
test('app skill installer backs up outside discovery and leaves credentials intact',()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'jev-apps-'));
  try{
    fs.mkdirSync(path.join(home,'.agents/jev-cu'),{recursive:true});fs.writeFileSync(path.join(home,'.agents/jev-cu/.env'),'KEEP');
    const r=installAppSkills('codex',{home});assert.equal(r.skills.length,4);assert.equal(r.configChanged,false);
    assert.ok(!fs.readFileSync(path.join(r.skills[0].destination,'SKILL.md'),'utf8').includes('{{REPO_DIR}}'));
    assert.throws(()=>installAppSkills('codex',{home}),/Skill exists/);
    const updated=installAppSkills('codex',{home,force:true});assert.ok(updated.skills.every(e=>e.backup.includes('skill-backups')&&!e.backup.includes(path.join('.agents','skills'))));
    installAppSkills('codex',{home,uninstall:true});assert.equal(fs.readFileSync(path.join(home,'.agents/jev-cu/.env'),'utf8'),'KEEP');
    assert.throws(()=>installAppSkills('__proto__',{home}));
  }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('all app skills have frontmatter, source-labelled evidence and independent workflow references',()=>{
  for(const name of APP_SKILLS){
    const file=new URL(`../skill/${name}/SKILL.md`,import.meta.url);const text=fs.readFileSync(file,'utf8');
    assert.ok(text.startsWith(`---\nname: ${name}\ndescription:`));assert.ok(text.includes('GPT'));assert.ok(text.includes('Jev'));
    assert.ok(text.includes('host_screenshot')||text.includes('host_screenshot'));
  }
});
