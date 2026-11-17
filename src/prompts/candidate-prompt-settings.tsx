import {useEffect,useState} from 'react';
import {candidateRequest} from './candidate-client';
import {useCandidateEditor} from './candidate-editor';
import {resumePromptProfile,resumePromptIssue,RESUME_PROMPT_PATH,resumePromptPath} from './resume-prompt-profile';
import {StatusBar} from './status-bar';
import {studioStorage} from '../../extension/studio/storage.js';

export function CandidatePromptSettings(){
  const [candidate,setCandidate]=useState(null),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
  const editor=useCandidateEditor(candidate),profile=editor.document?resumePromptProfile(editor.document):null,issue=editor.document?resumePromptIssue(editor.document):null;
  useEffect(()=>{
    let alive=true,sequence=0;
    const load=async()=>{const current=++sequence;try{const result=await candidateRequest('PROMPT_SETTINGS',{});if(alive&&current===sequence){setCandidate(result.candidate);setLoaded(true);setError('');}}catch(reason){if(alive&&current===sequence){setError(reason.message);setLoaded(true);}}};
    void load();const changed=(changes,area)=>{if(area==='local'&&Object.keys(changes).some(key=>key==='active-candidate:v1'||key.startsWith('autofill-profile:')))void load();};
    studioStorage.onChanged.addListener(changed);return()=>{alive=false;sequence++;studioStorage.onChanged.removeListener(changed);};
  },[]);
  function field(label:string,value:unknown,path:string[],token:string,numeric?:'years'|'bullets'){
    const invalid=issue?.path===resumePromptPath(...path);
    return <label className="candidate-default-field" key={path.join('.')}><span>{label}</span><input aria-label={label} aria-invalid={invalid} value={typeof value==='string'||typeof value==='number'?String(value):''} inputMode={numeric?'decimal':'text'} placeholder={numeric==='bullets'?'No minimum':undefined} onChange={event=>{
      const raw=event.target.value;
      const valid=numeric==='bullets'?/^\d+$/.test(raw)&&Number.isSafeInteger(Number(raw))&&Number(raw)>=1:/^\d+(?:\.\d+)?$/.test(raw)&&Number.isFinite(Number(raw))&&Number(raw)>=0;
      editor.change([...RESUME_PROMPT_PATH,...path],numeric?raw.trim()?valid?Number(raw):raw:null:raw);
    }} /><code>{`{{${token}}}`}</code>{invalid&&<span role="alert">{issue.message}</span>}</label>;
  }
  function resetDefaults(){
    const preferences=structuredClone((editor.document?.applicationPreferences as any)?.resumePrompt||{});
    for(const key of ['name','location','seniority','yearsOfExperience'])delete preferences[key];
    for(const role of Object.values(preferences.roles||{}) as any[])for(const key of ['company','location','dates','minimumBullets'])delete role[key];
    for(const entry of Object.values(preferences.education||{}) as any[])for(const key of ['degree','school','description','dates'])delete entry[key];
    editor.change(RESUME_PROMPT_PATH,preferences);
  }
  return <section className="prompt-settings candidate-prompt-settings" aria-labelledby="candidate-prompt-title">
    <header className="settings-pane-heading"><div><span className="web-eyebrow">AI settings</span><h2 id="candidate-prompt-title">Candidate Form</h2><p>Set default values for prompt placeholders. Values start from your saved profile; edits here apply to AI prompts.</p></div></header>
    {!!editor.messages.length&&<StatusBar messages={editor.messages} />}
    {error&&<p role="alert">{error}</p>}{!loaded&&<p role="status">Loading candidate defaults…</p>}
    {loaded&&!profile&&!error&&<p>Create your profile in <a href="#/settings/profile">Profile settings</a> to set candidate defaults.</p>}
    {profile&&<form noValidate onSubmit={event=>{event.preventDefault();void editor.save();}}><fieldset disabled={editor.busy}>
      <section className="setup-group"><h3>Candidate</h3><div className="candidate-default-grid">
        {field('Candidate full name',profile.name,['name'],'candidate_name')}
        {field('Candidate location',profile.location,['location'],'candidate_location')}
        {field('Candidate seniority',profile.seniority,['seniority'],'candidate_seniority')}
        {field('Years of experience',profile.yearsOfExperience,['yearsOfExperience'],'years_of_experience','years')}
      </div></section>
      {profile.roles.map((role,index)=><section className="setup-group" key={role.id}><h3>Company {index+1}</h3><p><code>{`{{company_${index+1}}}`}</code> combines the name, location, and period.</p><div className="candidate-default-grid candidate-history-grid">
        {field(`Company ${index+1} name`,role.company,['roles',role.id,'company'],`company_${index+1}_name`)}
        {field(`Company ${index+1} location`,role.location,['roles',role.id,'location'],`company_${index+1}_location`)}
        {field(`Company ${index+1} period`,role.dates,['roles',role.id,'dates'],`company_${index+1}_period`)}
      </div></section>)}
      {profile.education.map((entry,index)=><section className="setup-group" key={entry.id}><h3>Education{profile.education.length>1?' '+(index+1):''}</h3><p><code>{index===0?'{{education}}':`{{education_${index+1}}}`}</code> combines the degree, university, and period.</p><div className="candidate-default-grid candidate-history-grid">
        {field(`Education ${index+1} degree level`,entry.degree,['education',entry.id,'degree'],index===0?'education_degree':`education_${index+1}_degree`)}
        {field(`Education ${index+1} university name`,entry.school,['education',entry.id,'school'],index===0?'education_university':`education_${index+1}_university`)}
        {field(`Education ${index+1} period`,entry.dates,['education',entry.id,'dates'],index===0?'education_period':`education_${index+1}_period`)}
      </div></section>)}
      <section className="setup-group"><h3>Bullet counts</h3><p>Minimum resume bullets per company. Leave blank for no minimum. <code>{'{{bullet_counts}}'}</code> includes all configured counts.</p><div className="candidate-default-grid">{profile.roles.map((role,index)=>field(`Company ${index+1} bullet count`,role.minimumBullets,['roles',role.id,'minimumBullets'],`company_${index+1}_bullets`,'bullets'))}</div></section>
      <div className="prompt-picker-row"><button type="submit" className="button button-primary" disabled={!editor.dirty||!!issue||editor.busy}>Save defaults</button><button type="button" className="button button-secondary" disabled={editor.busy} onClick={resetDefaults}>Use profile defaults</button><span role="status">{editor.dirty?'Unsaved changes.':''}</span></div>
    </fieldset></form>}
  </section>;
}
