import test from 'node:test';
import assert from 'node:assert/strict';
import {dockFixture,event} from './helpers/dock-records-fixture.mjs';
import {resumeRenderer} from './helpers/resume-renderer.mjs';
import {setStudioPDFBackend,renderStudioPDF} from '../extension/ai-apply/src/studio-pdf.mjs';
import {exportDocuments} from '../extension/ai-apply/src/document-export.mjs';
import {savedPDFPreview} from '../extension/ai-apply/src/saved-pdf-preview.mjs';
import {savedCoverLetter} from '../extension/studio/saved-cover-letter.js';
import {parseQueueCoverLetter} from '../extension/studio/queue-resume-editor.js';
import {createDocumentDownloads} from '../extension/ai-apply/src/document-downloads.mjs';

test('AI PDF exports, saved previews and cover-letter attachments use real Studio rendering and frozen settings',async t=>{
  const app=await dockFixture(t),studio=await resumeRenderer(),rendered=[];
  app.deps.makeSnapshot=(candidate,draft)=>{
    const snapshot=studio.fixture(draft.documentTemplate.id);
    snapshot.candidate=structuredClone(candidate.document.candidate);snapshot.draftId=draft.id;
    snapshot.resume=JSON.parse(draft.cvJsonRaw);
    for(const key of ['experience','education'])snapshot.bindings[key]=snapshot.resume[key].map((_,index)=>snapshot.bindings[key][index]??null);
    return {snapshot};
  };
  app.deps.renderRecordPDF=async(record,kind)=>{
    const snapshot=record.resume.snapshot;
    const letter=kind==='letter'?parseQueueCoverLetter(record.coverLetterRaw,snapshot.candidate.id,snapshot.draftId):null;
    const pdf=await studio.render(snapshot,letter);
    rendered.push({snapshot:structuredClone(snapshot),kind,letter,pdf});
    return {base64:Buffer.from(pdf.bytes).toString('base64'),sha256:pdf.sha256,pageCount:pdf.pageCount,filename:kind+'.pdf'};
  };
  app.restart();
  setStudioPDFBackend(payload=>app.request('AI_APPLY_RENDER_PDF',payload));t.after(()=>setStudioPDFBackend(undefined));
  let record=await app.create();
  const initial=await app.request('AI_APPLY_READ'),job=initial.requests[0],resume=studio.fixture('rendercv-classic').resume;
  resume.company=record.company;resume.title=record.role;
  const run={id:'ai-run',jobId:job.id,job,phase:'complete',result:{resume,coverLetter:'Dear hiring team,\n\nI build reliable services.'},documentSettings:{formats:['pdf'],includeCoverLetter:true}};
  const beforeDraft=structuredClone(app.draft),beforeStorage=await app.storage.get(null);
  let result=await exportDocuments(run);
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.files.map(file=>file.kind),['resume','cover-letter']);
  assert.deepEqual(result.files.map(file=>file.filename),[run.job.input.profile.name+'.pdf','cover letter.pdf']);
  assert.equal(rendered[0].snapshot.documentTemplate.id,'rendercv-classic');
  assert.equal(rendered[0].snapshot.profile.education[0].school,'Example University');
  assert.equal(rendered[1].kind,'letter');assert.deepEqual(rendered[1].letter.paragraphs,['Dear hiring team,','I build reliable services.']);
  assert.deepEqual(result.files[0].bytes,Uint8Array.from(rendered[0].pdf.bytes));
  assert.ok(result.files.every(file=>Buffer.from(file.bytes).subarray(0,5).toString()==='%PDF-'));
  assert.deepEqual(await app.storage.get(null),beforeStorage,'Rendering an unsaved AI result does not save it');
  assert.deepEqual(app.draft,beforeDraft,'Studio editor stays unchanged');

  const letterOnly=await exportDocuments({...run,result:{resume:null,coverLetter:run.result.coverLetter},documentSettings:{formats:['pdf'],includeResume:false,includeCoverLetter:true}});
  assert.deepEqual(letterOnly.errors,[]);assert.deepEqual(letterOnly.files.map(file=>file.kind),['cover-letter']);
  assert.equal(Buffer.from(letterOnly.files[0].bytes).subarray(0,5).toString(),'%PDF-');
  assert.deepEqual(await app.storage.get(null),beforeStorage);
  const selected=await app.request('AI_APPLY_COMMIT',{changes:[{record:{...job,input:{...job.input,resumeTemplate:'harvard'}},expectedRevision:job.canonicalRevision}],deleted:[]});
  run.job=selected.requests[0];
  result=await exportDocuments(run,{kinds:['resume']});assert.deepEqual(result.errors,[]);
  assert.equal(rendered.at(-1).snapshot.documentTemplate.id,'harvard','AI template selection is rendered by Studio');
  await app.request('AI_APPLY_COMMIT',{changes:[{record:{...run.job,resume,coverLetter:run.result.coverLetter,coverLetterEnabled:true},expectedRevision:run.job.canonicalRevision}],deleted:[]});
  record=(await app.request('DOCK_RECORDS_STATE')).jobs.find(row=>row.id===record.id);
  const frozen=structuredClone(record.resume.snapshot),stored=await app.storage.get(null);
  // Later editor/profile settings must not change a submitted document snapshot.
  app.draft.documentTemplate={id:'ember',version:1};
  result=await exportDocuments(run,{kinds:['resume']});assert.deepEqual(result.errors,[]);
  assert.deepEqual(rendered.at(-1).snapshot,frozen);
  const cached=new Map(),url=new URL(await savedPDFPreview({...job,resume,coverLetter:run.result.coverLetter},{browser:app.browser,store:{put:async file=>cached.set(file.key,file)}}));
  assert.equal(url.pathname,'/preview.html');assert.equal(cached.get(url.searchParams.get('aiFile')).format,'pdf');
  assert.deepEqual(rendered.at(-1).snapshot,frozen);
  const letter=await savedCoverLetter(record);assert.ok(atob(letter.resumeBase64).startsWith('%PDF-'));assert.equal(rendered.at(-1).kind,'letter');
  assert.deepEqual(await app.storage.get(null),stored,'Saved previews and downloads do not create resume versions');

  const state={runs:[{...structuredClone(run),documentSettings:{...run.documentSettings,autoPreview:false}}]},downloads=[],fileRecords=new Map();
  const store={get:async id=>structuredClone(state.runs.find(row=>row.id===id)),read:async()=>structuredClone(state),change:async edit=>({value:structuredClone(edit(state)),state:structuredClone(state)})};
  const browser={...app.browser,downloads:{onChanged:event(),download:async options=>{downloads.push(options);return downloads.length;},search:async()=>[{state:'complete'}]}};
  await browser.storage.local.set({documentSettings:{formats:['pdf'],autoPreview:false}});
  const savedJob={...run.job,resume,coverLetter:run.result.coverLetter,coverLetterEnabled:true,input:{...run.job.input,profile:{name:'Test Candidate',role:resume.title,summary:resume.summary,skills:resume.skills.flatMap(group=>Object.values(group).flat()),experience:resume.experience,education:resume.education}}};
  const delivery=createDocumentDownloads({browser,store,files:{get:async key=>fileRecords.get(key),put:async file=>fileRecords.set(file.key,file)},jobs:{getJob:async()=>savedJob},saveGenerated:async()=>{}});
  t.after(()=>delivery.dispose());
  await delivery.start(run.id);assert.equal(state.runs[0].downloads.state,'complete');assert.equal(downloads.length,2);
  const manual=await delivery.startSaved(record.id,'resume');assert.equal(manual.state,'complete');assert.equal(downloads.length,3);
  assert.ok(downloads.every(file=>atob(file.url.split(',')[1]).startsWith('%PDF-')));
  assert.deepEqual(rendered.at(-1).snapshot,frozen,'Automatic and manual downloads reuse the same Studio snapshot');
  await assert.rejects(renderStudioPDF({...run,jobId:'missing'},'resume'),/no longer available/);
  await assert.rejects(renderStudioPDF({...run,job:{...job,input:{...job.input,candidateId:'other'}}},'resume'),/current profile/);
  await assert.rejects(renderStudioPDF({...run,job:{...job,input:{...job.input,job:{...job.input.job,description:'Old JD'}}}},'resume'),/job changed/);
});

test('PDF rendering failure is reported without falling back to the AI Apply layout; JSON remains exportable',async()=>{
  const run={id:'run',jobId:'job',phase:'complete',job:{input:{profile:{name:'Candidate'},job:{company:'Employer'}}},result:{resume:{title:'Engineer',summary:'Summary',skills:[],experience:[],education:[]}},documentSettings:{formats:['pdf','json'],includeCoverLetter:false}};
  const output=await exportDocuments(run,{renderPDF:async()=>{throw Error('Studio renderer unavailable');}});
  assert.deepEqual(output.files.map(file=>file.format),['json']);
  assert.deepEqual(output.errors,[{kind:'resume',format:'pdf',message:'Studio renderer unavailable'}]);
});

test('extension pages request Studio PDFs through the worker bridge',async()=>{
  setStudioPDFBackend(undefined);const sent=[];
  const browser={runtime:{sendMessage:async message=>{sent.push(message);return {ok:true,value:{base64:btoa('%PDF-1.7\nStudio')}};}}};
  const run={jobId:'job',job:{input:{candidateId:'profile'}},result:{resume:{title:'Engineer'},coverLetter:''}};
  await renderStudioPDF(run,'resume',{browser});
  assert.equal(sent[0].type,'ai-apply.pdf');assert.equal(sent[0].payload.jobId,'job');assert.equal(sent[0].payload.candidateId,'profile');
  await assert.rejects(renderStudioPDF(run,'resume',{browser:{runtime:{sendMessage:async()=>({ok:false,error:'Denied'})}}}),/Denied/);
});
