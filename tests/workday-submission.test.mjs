import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {WORKDAY_ARM,WORKDAY_RESULT,workdayFinalizeRequest,successfulWorkdayFinalize,validateWorkdaySubmission,installWorkdaySubmissionObserver} from '../extension/studio/workday-submission.js';

const page='https://example.myworkdayjobs.com/en-US/Careers/job/Engineer_R123/apply/review',path='/wday/cxs/example/jobapplication/application-123/finalize';
test('Workday only accepts the bound finalize endpoint and business success',()=>{
  assert.deepEqual(workdayFinalizeRequest(path,page),{applicationId:'application-123',requestPath:path});
  assert.equal(workdayFinalizeRequest('https://unrelated.test'+path,page),null);assert.equal(workdayFinalizeRequest(path,page,'GET'),null);
  assert.equal(successfulWorkdayFinalize(200,{id:'application-123'}),true);assert.equal(successfulWorkdayFinalize(200,{id:'application-123',errors:['Missing answer']}),false);
  assert.equal(successfulWorkdayFinalize(500,{id:'application-123'}),false);
  const pending={id:'attempt',at:1000,fromUrl:page},proof={attemptId:'attempt',pageUrl:page,requestPath:path,applicationId:'application-123',status:200,success:true,startedAt:1001};
  assert.equal(validateWorkdaySubmission(proof,pending,1100),true);assert.equal(validateWorkdaySubmission({...proof,attemptId:'other'},pending,1100),false);
  assert.equal(validateWorkdaySubmission(proof,pending,400000),false);assert.equal(validateWorkdaySubmission({...proof,applicationId:'other'},pending,1100),false);
});

test('main-world observation preserves fetch behavior and forwards only an armed successful receipt',async()=>{
  const listeners=new Map(),pageListeners=new Map(),calls=[],results=[];
  const response=value=>({status:200,redirected:false,clone:()=>({body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify(value)));controller.close();}})})});
  let value={id:'application-123'};
  const win={location:{href:page},document:{addEventListener:(name,listener)=>pageListeners.set(name,listener)},addEventListener:(name,listener)=>listeners.set(name,listener),dispatchEvent:event=>{if(event.type===WORKDAY_RESULT)results.push(JSON.parse(event.detail));listeners.get(event.type)?.(event);},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},TextDecoder,fetch:async(...args)=>{calls.push(args);return response(value);}};
  installWorkdaySubmissionObserver(win);
  await win.fetch(path,{method:'POST'});await delay(0);assert.equal(results.length,0,'Unarmed requests must not become application records');
  pageListeners.get('click')({isTrusted:true,composedPath:()=>[{matches:()=>true,disabled:false,textContent:'Submit application'}]});
  const at=Date.now();listeners.get(WORKDAY_ARM)({detail:JSON.stringify({attemptId:'attempt',pageUrl:page,at})});
  const result=await win.fetch(path,{method:'POST'});assert.equal(result.status,200);await delay(0);
  assert.equal(results.length,1);assert.equal(validateWorkdaySubmission(results[0],{id:'attempt',at,fromUrl:page}),true);
  value={id:'application-123',errors:['Required field missing']};pageListeners.get('click')({isTrusted:true,composedPath:()=>[{matches:()=>true,disabled:false,textContent:'Submit'}]});
  listeners.get(WORKDAY_ARM)({detail:JSON.stringify({attemptId:'attempt-2',pageUrl:page,at:Date.now()})});
  await win.fetch(path,{method:'POST'});await delay(0);assert.equal(results.length,1);assert.equal(calls.length,3);
});
