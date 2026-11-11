import {useEffect,useState} from 'react';
import {MEETING_TIMEZONE_KEY,resolveMeetingTimezone,meetingTimezones} from '../../extension/studio/meeting-timezone.js';

export function MeetingTimezoneSettings(){
  const [value,setValue]=useState('system'),[busy,setBusy]=useState(true),[message,setMessage]=useState('');
  useEffect(()=>{
    let alive=true;
    const changed=(changes,area)=>{if(alive&&area==='local'&&changes[MEETING_TIMEZONE_KEY])setValue(changes[MEETING_TIMEZONE_KEY].newValue||'system');};
    chrome.storage.onChanged.addListener(changed);
    chrome.storage.local.get(MEETING_TIMEZONE_KEY).then(saved=>{if(alive)setValue(saved[MEETING_TIMEZONE_KEY]||'system');}).catch(error=>{if(alive)setMessage(error.message);}).finally(()=>{if(alive)setBusy(false);});
    return()=>{alive=false;chrome.storage.onChanged.removeListener(changed);};
  },[]);
  async function change(next){
    setBusy(true);setMessage('');
    try{await chrome.storage.local.set({[MEETING_TIMEZONE_KEY]:next});setValue(next);setMessage('Meeting timezone saved.');}
    catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  const zones=meetingTimezones(value);
  return <section className="setup-group meeting-timezone-settings" aria-labelledby="meeting-timezone-title"><h3 id="meeting-timezone-title">Meeting timezone</h3><p>Use this timezone to display and edit meeting dates and times.</p><label>Timezone<select aria-label="Meeting timezone" value={value} disabled={busy} onChange={event=>void change(event.target.value)}><option value="system">Browser timezone ({resolveMeetingTimezone('system')})</option>{zones.map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}</select></label>{message&&<p role="status">{message}</p>}</section>;
}
