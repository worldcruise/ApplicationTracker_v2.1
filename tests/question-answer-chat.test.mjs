import test from 'node:test';
import assert from 'node:assert/strict';
import {answerBatchPrompt,validateAnswerBatch,createQuestionAnswerChat,sendQuestionBatch,readQuestionBatch} from '../extension/studio/question-answer-chat.js';
import {memoryStorage} from './helpers/dock-records-fixture.mjs';
import vm from 'node:vm';
const job={id:'job-1',input:{profile:{name:'Applicant',resumeData:{resumeBase64:'PRIVATE_FILE_BYTES'}},job:{company:'Employer',role:'Engineer'}}};
const fields=[{key:'frame:why',label:'Why this role?',required:true},{key:'frame:choice',label:'Work arrangement',options:[{value:'remote',label:'Remote'}]}];

test('Autofill prompt placeholders use saved defaults when explicitly included',async()=>{
 let reads=0,sent='';
 const browser={storage:{session:memoryStorage({}),local:memoryStorage({'ai-writing-prompts:v1':{autofill:'Answer as {{candidate_name}} with {{years_of_experience}} years.'}})},tabs:{query:async()=>[],create:async options=>({id:7,...options}),get:async()=>({id:7,url:"https://chatgpt.com/"})},scripting:{executeScript:async request=>{if(request.files)return[];sent=request.args[0].prompt;return [{result:{ready:true}}];}}};
 const chat=createQuestionAnswerChat(browser,{readPromptValues:async()=>{reads++;return {candidate_name:'Test Candidate',years_of_experience:'8'};}});
 await chat.start(job,fields,41);
 assert.equal(reads,1);assert.match(sent,/Answer as Test Candidate with 8 years\./);assert.doesNotMatch(sent,/{{candidate_name}}|PRIVATE_FILE_BYTES/);
});
test('answer batches exclude file bytes and require every selected question and exact batch IDs',()=>{
 const batch=answerBatchPrompt(job,fields,'batch-1'),run={id:'batch-1',jobId:job.id,questions:batch.questions};assert.match(batch.prompt,/DOCUMENT_RUN:batch-1/);assert.ok(!batch.prompt.includes('PRIVATE_FILE_BYTES'));assert.ok(!batch.prompt.includes('Applicant'));assert.ok(!batch.prompt.includes('CANDIDATE FACTS:'));assert.match(batch.prompt,/already in this conversation/);
 assert.match(batch.prompt,/first person/);assert.match(batch.prompt,/2–3 substantive sentences in one paragraph/);assert.match(batch.prompt,/Do not invent company names/);assert.match(batch.prompt,/one separate JSON object per question/);assert.ok(!batch.prompt.includes('Andrew Alsworth'));assert.equal(batch.questions[0].required,true);
 const reply={requestId:job.id,runId:run.id,answers:[{id:'frame:why',answer:'I enjoy building reliable products.',needsUser:false},{id:'frame:choice',answer:'Remote',needsUser:false}]};
 assert.equal(validateAnswerBatch('```json\n'+JSON.stringify(reply)+'\n```',run)[1].answer,'remote');
 assert.throws(()=>validateAnswerBatch(JSON.stringify({...reply,runId:'old-batch'}),run),/match/);
 assert.throws(()=>validateAnswerBatch(JSON.stringify({...reply,answers:[reply.answers[0],reply.answers[0]]}),run),/duplicate/);
 assert.throws(()=>validateAnswerBatch(JSON.stringify({...reply,answers:reply.answers.slice(0,1)}),run),/every/);
 const unknown=structuredClone(reply);unknown.answers[1].answer='Invented choice';assert.deepEqual(validateAnswerBatch(JSON.stringify(unknown),run)[1],{id:'frame:choice',answer:'',needsUser:true});
});

test('ChatGPT sending preserves unsent drafts and uses the native adapter without replacing drafts',async()=>{
 let sent=0,options;const editor={value:'My unfinished message'},adapter={login:()=>false,editor:()=>editor,busy:()=>false};
 const context={run:{id:'run',provider:'chatgpt',prompt:'Questions'},AbortController,AiAgentChatGPTGeneration:adapter,__techIntChatAdapterV2:{ChatGPTAdapter:class{async send(prompt,signal,value){sent++;options=value;assert.equal(prompt,'Questions');}}}};
 await assert.rejects(vm.runInNewContext(`(${sendQuestionBatch.toString()})(run)`,context),/unsent draft/);assert.equal(sent,0);assert.equal(editor.value,'My unfinished message');
 editor.value='';assert.equal((await vm.runInNewContext(`(${sendQuestionBatch.toString()})(run)`,context)).ready,true);assert.equal(sent,1);assert.equal(options.replaceDraft,false);
});

test('separate question and answer objects map back to fields and reject incomplete or unrelated replies',()=>{
 const {prompt,questions}=answerBatchPrompt(job,fields,'batch-objects'),run={questions,outputFormat:'question-answer-objects'};
 assert.match(prompt,/one separate JSON object per question/);assert.match(prompt,/"question": "Why this role\?"/);
 const raw='{"question":"Work arrangement","answer":"Remote"}\n\n{"question":"Why this role?","answer":"I build reliable products."}';
 assert.deepEqual(validateAnswerBatch(raw,run),[{id:'frame:choice',answer:'remote',needsUser:false},{id:'frame:why',answer:'I build reliable products.',needsUser:false}]);
 assert.throws(()=>validateAnswerBatch('{"question":"Wrong question","answer":"x"}\n{"question":"Why this role?","answer":"y"}',run),/unknown/);
 assert.throws(()=>validateAnswerBatch('{"question":"Why this role?","answer":"x"}',run),/every/);
 const duplicate={questions:[{id:'a',question:'Same question'},{id:'b',question:'Same question'}],outputFormat:run.outputFormat};assert.deepEqual(validateAnswerBatch('{"question":"Same question","answer":"First"}\n{"question":"Same question","answer":"Needs my answer"}',duplicate),[{id:'a',answer:'First',needsUser:false},{id:'b',answer:'',needsUser:true}]);
});

test('AI drafts keep multi-select choices in one question and return all enabled choices using the existing answer-string format',()=>{
 const field={key:'work',label:'Work arrangements',type:'select-multiple',multiple:true,options:[{value:'remote',label:'Remote'},{value:'hybrid',label:'Hybrid'},{value:'onsite',label:'Onsite',disabled:true}]},batch=answerBatchPrompt(job,[field],'multi'),run={questions:batch.questions,outputFormat:'question-answer-objects'};
 assert.equal(batch.questions.length,1);assert.equal(batch.questions[0].multiple,true);assert.ok(batch.prompt.includes(JSON.stringify({question:'Work arrangements',answer:'["remote","hybrid"]'})));
 const reply=answer=>JSON.stringify({question:'Work arrangements',answer});assert.deepEqual(validateAnswerBatch(reply('["Remote","Hybrid"]'),run),[{id:'work',answer:'["remote","hybrid"]',needsUser:false}]);
 assert.deepEqual(validateAnswerBatch(reply('["Onsite"]'),run),[{id:'work',answer:'',needsUser:true}]);assert.deepEqual(validateAnswerBatch(reply('["Unknown"]'),run),[{id:'work',answer:'',needsUser:true}]);
});
for(const provider of ['chatgpt','deepseek'])test(`${provider} answer runs send once, collect only completed replies and recover from service recreation`,async()=>{
 const session=memoryStorage({}),tabs=new Map();let sent=0,complete=false;
 const browser={storage:{session,local:memoryStorage({chatProvider:provider})},tabs:{query:async()=>[...tabs.values()],create:async input=>{const tab={id:7,...input};tabs.set(7,tab);return tab;},get:async id=>{if(!tabs.has(id))throw Error('Tab closed');return tabs.get(id);}},scripting:{executeScript:async request=>{
   if(request.files)return[];const run=request.args[0];if(request.func===sendQuestionBatch){sent++;assert.match(run.prompt,/Work arrangement/);return[{result:{ready:true}}];}
   assert.equal(request.func,readQuestionBatch);return[{result:{complete,raw:run.questions.map(field=>JSON.stringify({question:field.question,answer:field.options.length?'remote':'A factual draft.'})).join('\n')}}];
 }}};
 const service=createQuestionAnswerChat(browser),started=await service.start(job,fields,41);assert.equal(started.provider,provider);assert.equal(sent,1);
 assert.equal((await service.status(started.id,41,job.id)).phase,'waiting');await assert.rejects(service.status(started.id,42,job.id),/different/);
 const recovered=createQuestionAnswerChat(browser);assert.equal((await recovered.start(job,fields,41)).id,started.id);assert.equal(sent,1);
 await assert.rejects(recovered.start(job,fields.slice(0,1),41),/Finish that batch/);assert.equal(sent,1);
 complete=true;const result=await recovered.status(started.id,41,job.id);assert.equal(result.phase,'complete');assert.equal(result.answers.length,2);assert.equal(sent,1);
 assert.equal((await recovered.status(started.id,41,job.id)).phase,'complete');assert.equal(sent,1);
 const next=await recovered.start({...job,id:'job-2'},fields,41);tabs.delete(7);assert.equal((await recovered.status(next.id,41,'job-2')).phase,'error');assert.equal(sent,2);
});
