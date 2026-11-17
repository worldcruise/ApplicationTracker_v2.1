import {useEffect,useState} from 'react';
import {readDashboard,saveDailyGoal} from '../../extension/studio/web-dashboard-data.js';

export function DailyGoalSettings(){
  const [value,setValue]=useState('10'),[busy,setBusy]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    let alive=true;
    const changed=(changes,area)=>{if(alive&&area==='local'&&changes.dailyGoal)setValue(String(changes.dailyGoal.newValue||10));};
    chrome.storage.onChanged.addListener(changed);
    readDashboard().then(data=>{if(alive)setValue(String(data.goal||10));}).catch(reason=>{if(alive)setError(reason.message);}).finally(()=>{if(alive)setBusy(false);});
    return()=>{alive=false;chrome.storage.onChanged.removeListener(changed);};
  },[]);
  async function save(event){
    event.preventDefault();setBusy(true);setError('');setMessage('');
    try{await saveDailyGoal(value);setMessage('Daily application goal saved.');}catch(reason){setError(reason.message);}finally{setBusy(false);}
  }
  return <section className="setup-group" aria-labelledby="daily-goal-title"><h3 id="daily-goal-title">Daily application goal</h3><p>Set the number of applications you want to submit each day.</p><form onSubmit={save}><label>Applications per day<input aria-label="Daily application goal" type="number" min="1" max="999" step="1" required value={value} disabled={busy} onChange={event=>setValue(event.target.value)} /></label><button type="submit" className="web-button" disabled={busy}>Save goal</button></form>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>;
}
