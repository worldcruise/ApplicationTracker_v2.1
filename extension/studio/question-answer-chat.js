import {normalizeWritingPrompts,readWritingPrompts} from '../ai-apply/src/writing-prompts.mjs';
import {substitutePromptPlaceholders} from './prompt-placeholders.js';
import {jsonObjects,providerHome,providerUrl} from '../ai-apply/src/generation-data.mjs';

const scripts=['ai-apply/src/build-info.js','ai-apply/src/generation-dom.js','ai-apply/src/chatgpt-submit-adapter.js','ai-apply/src/generation-chatgpt.js','ai-apply/src/generation-deepseek.js'];
function supportedChatPage(value,provider){
  if(providerUrl(value,provider))return true;
  try{const url=new URL(value);return provider==='chatgpt'&&url.origin===providerHome('chatgpt').slice(0,-1)&&!url.username&&!url.password&&/^\/c\/local-chatgpt(?::|%3a)[\w-]+\/?$/i.test(url.pathname);}catch{return false;}
}
export function answerBatchPrompt(job,fields,id,writingPrompts){
  if(!Array.isArray(fields)||fields.length>500)throw Error('Select up to 500 questions.');
  const questions=fields.filter(field=>!field.filled&&field.type!=='file').map(field=>({id:field.key,question:String(field.label||'').slice(0,2000),type:field.type||'text',...field.multiple||field.type==='select-multiple'?{multiple:true}:{},required:!!field.required||/\*\s*$/.test(field.label||''),answer:String(field.answer||'').slice(0,10000),options:field.type==='checkbox'?[{value:'Yes',label:'Yes'},{value:'No',label:'No'}]:field.options||[]}));
  if(!questions.length||questions.some(field=>typeof field.id!=='string'||!field.id)||new Set(questions.map(field=>field.id)).size!==questions.length)throw Error('Select unanswered application questions.');
  const prompt=[`DOCUMENT_RUN:${id}`,substitutePromptPlaceholders(normalizeWritingPrompts(writingPrompts).autofill,job.input.promptValues||{}),
    ...job.input.autofillInstructions?['APPLICATION INSTRUCTIONS\n'+substitutePromptPlaceholders(job.input.autofillInstructions,job.input.promptValues||{})]:[],
    'Use only factual candidate information already in this conversation. If an essential fact is unknown, use exactly "Needs my answer". Preserve the required answer format below.',
    'Return one separate JSON object per question, in the original question order. Each object must contain only question and answer. Copy each question exactly. Include every question once, including repeated questions. Use double-quoted strings and escape any quotes or line breaks inside answers. Do not add an outer array, IDs, headings or commentary. Use this format:',
    ...questions.some(field=>field.multiple)?[`For a question with multiple=true, answer remains a string containing a JSON array of selected option values. For example: ${JSON.stringify({question:'Work arrangements',answer:JSON.stringify(['remote','hybrid'])})}. Choose only listed, enabled options. Single-select questions take one option value.`]:[],
    questions.map(field=>JSON.stringify({question:field.question,answer:'Your suggested answer'},null,2)).join('\n\n'),
    'JOB: '+JSON.stringify(job.input.job),'QUESTIONS: '+JSON.stringify(questions)].join('\n\n');
  if(prompt.length>200000)throw Error('This batch is too large. Select fewer questions.');
  return {prompt,questions};
}
function choiceAnswer(field,answer){
  if(!field.options?.length)return answer;
  if(field.multiple||field.type==='select-multiple') {
    let values;try{values=JSON.parse(answer);}catch{values=[answer];}
    if(!Array.isArray(values)||!values.length||values.some(value=>typeof value!=='string'))return '';
    const options=values.map(value=>field.options.find(option=>!option.disabled&&(option.value===value||option.label===value)));
    return options.every(Boolean)?JSON.stringify([...new Set(options.map(option=>option.value))]):'';
  }
  return field.options.find(option=>!option.disabled&&(option.value===answer||option.label===answer))?.value||'';
}
export function validateAnswerBatch(raw,run){
  if(run.outputFormat==='question-answer-objects'){
    const objects=jsonObjects(raw),remaining=[...run.questions];
    if(objects.length!==remaining.length)throw Error('The AI reply must include one question and answer block for every selected question.');
    return objects.map(item=>{
      if(typeof item.question!=='string'||typeof item.answer!=='string'||item.answer.length>10000||Object.keys(item).some(key=>!['question','answer'].includes(key)))throw Error('The AI returned an invalid question and answer block.');
      const index=remaining.findIndex(field=>field.question.replace(/\s+/g,' ').trim()===item.question.replace(/\s+/g,' ').trim());
      if(index<0)throw Error('The AI returned an unknown or duplicate question.');
      const [field]=remaining.splice(index,1);let answer=item.answer.trim(),needsUser=!answer||/^needs my answer$/i.test(answer);
      if(!needsUser){answer=choiceAnswer(field,answer);needsUser=!answer;}
      return {id:field.id,answer:needsUser?'':answer,needsUser};
    });
  }
  const matches=jsonObjects(raw).filter(value=>value?.requestId===run.jobId&&value?.runId===run.id);
  if(matches.length!==1)throw Error('The AI reply did not match this question batch. Open the chat to review it.');
  const value=matches[0],expected=new Map(run.questions.map(field=>[field.id,field])),seen=new Set();
  if(!Array.isArray(value.answers)||value.answers.length!==expected.size)throw Error('The AI reply must include every selected question.');
  return value.answers.map(item=>{
    const field=expected.get(item?.id);
    if(!field||seen.has(item.id)||typeof item.answer!=='string'||item.answer.length>10000||typeof item.needsUser!=='boolean')throw Error('The AI returned invalid or duplicate answers.');
    seen.add(item.id);let answer=item.answer.trim(),needsUser=item.needsUser||!answer;
    if(!needsUser){answer=choiceAnswer(field,answer);needsUser=!answer;}
    return {id:item.id,answer:needsUser?'':answer,needsUser};
  });
}
export async function sendQuestionBatch(run){
  const adapter=run.provider==='deepseek'?globalThis.AiAgentDeepSeekGeneration:globalThis.AiAgentChatGPTGeneration;
  if(!adapter)throw Error('The AI chat adapter is unavailable.');
  if(adapter.login())return {ready:false};
  const editor=adapter.editor();if(!editor)return {ready:false};
  if((editor.value??editor.innerText??editor.textContent??'').trim())throw Error('Your AI chat has an unsent draft. Send or clear it, then try again.');
  if(adapter.busy())throw Error('The AI chat is already generating a response. Wait for it to finish.');
  if(run.provider==='chatgpt'&&globalThis.__techIntChatAdapterV2?.ChatGPTAdapter){
    await new globalThis.__techIntChatAdapterV2.ChatGPTAdapter().send(run.prompt,new AbortController().signal,{requestId:run.id,source:'panel',action:'prepared',replaceDraft:false,beforeSubmit:async()=>{}});
  }else if(adapter.send)await adapter.send(run,{signal:new AbortController().signal,beforeSubmit:async()=>{}});
  else{
    const dom=globalThis.AiAgentGenerationDOM;dom.fill(editor,run.prompt);let submitted=false;
    for(let attempt=0;attempt<60;attempt++){
      await new Promise(resolve=>setTimeout(resolve,250));const current=adapter.editor();
      if(!current||dom.normal(dom.text(current))!==dom.normal(run.prompt)||dom.hasAttachment(current))throw Error('The AI composer changed. Your draft was preserved.');
      const control=adapter.control(current);if(attempt>=1&&control&&!dom.disabled(control)&&!adapter.busy()){control.click();submitted=true;break;}
    }
    if(!submitted)throw Error('The AI Send control is unavailable. Check the prepared draft in the chat.');
  }
  return {ready:true};
}
export function readQuestionBatch(run){
  const adapter=run.provider==='deepseek'?globalThis.AiAgentDeepSeekGeneration:globalThis.AiAgentChatGPTGeneration;
  if(!adapter)return {missing:true};
  const answer=adapter.answer(run),objects=run.outputFormat==='question-answer-objects';
  const contentReady=objects&&!!answer.user&&globalThis.AiAgentGenerationDOM?.completedAnswerObjects?.(answer.raw,run)&&!adapter.busy(answer);
  return {complete:objects?!!answer.user&&(!!answer.complete||!!contentReady):!!answer.complete,raw:answer.raw};
}
export function createQuestionAnswerChat(browser,{readPromptValues=async job=>job.input.promptValues||{}}={}){
  const key=id=>`apply-answer-batch:v1:${id}`,active=windowId=>`apply-answer-active:v1:${windowId}`;
  let starts=Promise.resolve();
  const save=run=>browser.storage.session.set({[key(run.id)]:run});
  async function start(job,fields,windowId,conversationUrl){
    const activeId=(await browser.storage.session.get(active(windowId)))[active(windowId)],previous=activeId&&(await browser.storage.session.get(key(activeId)))[key(activeId)];
    const writing=await readWritingPrompts(browser);
    const promptJob=/{{[^{}]+}}/.test(writing.autofill+'\n'+(job.input.autofillInstructions||''))?{...job,input:{...job.input,promptValues:await readPromptValues(job)}}:job;
    const provider=(await browser.storage.local.get('chatProvider')).chatProvider==='deepseek'?'deepseek':'chatgpt',id=crypto.randomUUID(),batch=answerBatchPrompt(promptJob,fields,id,writing);
    if(previous&&['sending','waiting'].includes(previous.phase)&&Date.now()-previous.createdAt<300000){
      if(previous.jobId===job.id&&previous.phase==='waiting'&&previous.provider===provider&&JSON.stringify(previous.questions)===JSON.stringify(batch.questions))return {id:previous.id,phase:previous.phase,provider:previous.provider};
      throw Error('An AI answer batch is already running in this window. Finish that batch before selecting different questions.');
    }
    const url=providerUrl(conversationUrl,provider,true)||providerHome(provider),tabs=await browser.tabs.query({windowId}),existing=tabs.find(tab=>tab.url===url&&url!==providerHome(provider));
    const tab=existing?await browser.tabs.update(existing.id,{active:true}):await browser.tabs.create({windowId,url,active:true});
    const run={id,jobId:job.id,windowId,tabId:tab.id,provider,kind:'application-answers',questions:batch.questions,phase:'sending',createdAt:Date.now(),sendIntentAt:Date.now(),outputFormat:'question-answer-objects'};
    await save(run);await browser.storage.session.set({[active(windowId)]:id});
    // Run only this explicitly requested batch; polling never sends it again.
    try{
      for(let attempt=0;attempt<32;attempt++){
        const tab=await browser.tabs.get(run.tabId);if(!supportedChatPage(tab.pendingUrl||tab.url,provider))throw Error('Sign in to your AI chat, then try again.');
        await browser.scripting.executeScript({target:{tabId:run.tabId},files:scripts});
        const result=(await browser.scripting.executeScript({target:{tabId:run.tabId},func:sendQuestionBatch,args:[{...run,prompt:batch.prompt}]}))[0]?.result;
        if(result?.ready){run.phase='waiting';await save(run);return {id,phase:run.phase,provider};}
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      throw Error('Sign in to the AI chat and wait for its message box, then try again.');
    }catch(error){run.phase='error';run.error=error.message;await save(run);throw error;}
  }
  return {start(...args){const result=starts.then(()=>start(...args));starts=result.catch(()=>{});return result;},async status(id,windowId,jobId){
    const run=(await browser.storage.session.get(key(id)))[key(id)];if(!run||run.windowId!==windowId||run.jobId!==jobId)throw Error('This AI answer batch belongs to a different application.');
    if((run.manualPrompt||run.manualAnswer)&&run.phase!=='complete'){run.phase='error';run.error='This batch used a retired copy mode. Start Draft answers with AI again.';delete run.manualPrompt;delete run.manualAnswer;delete run.initialClipboardHash;await save(run);}
    if(run.phase==='waiting')try{
      if(Date.now()-run.createdAt>300000)throw Error('The AI reply timed out. Check the chat before trying again.');
      const tab=await browser.tabs.get(run.tabId);if(!supportedChatPage(tab.url,run.provider))throw Error('The AI chat tab changed or closed.');
      const reply=(await browser.scripting.executeScript({target:{tabId:run.tabId},func:readQuestionBatch,args:[run]}))[0]?.result;
      if(reply?.missing){await browser.scripting.executeScript({target:{tabId:run.tabId},files:scripts});return {id,phase:'waiting'};}
      if(reply?.complete&&reply.raw){run.answers=validateAnswerBatch(reply.raw,run);run.phase='complete';await save(run);}
    }catch(error){run.phase='error';run.error=error.message;await save(run);}
    return {id,phase:run.phase,...run.phase==='complete'?{answers:run.answers}:{},...run.error?{error:run.error}:{}};
  }};
}
