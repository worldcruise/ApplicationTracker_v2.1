export const MEETING_TIMEZONE_KEY='meeting-timezone:v1';
export function resolveMeetingTimezone(value){
  if(value&&value!=='system')try{new Intl.DateTimeFormat('en',{timeZone:value});return value;}catch{}
  return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
}
export function meetingTimezones(value){
  const commonUS=['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','America/Anchorage','Pacific/Honolulu'];
  const otherUS=new Set(['America/Adak','America/Boise','America/Detroit','America/Indianapolis','America/Louisville','America/Juneau','America/Metlakatla','America/Nome','America/Sitka','America/Yakutat','America/Menominee','America/Puerto_Rico','America/St_Thomas','Pacific/Guam','Pacific/Saipan','Pacific/Pago_Pago']);
  const zones=[...new Set([...commonUS,'UTC',resolveMeetingTimezone(value),...(Intl.supportedValuesOf?.('timeZone')||['Europe/London','Europe/Paris','Asia/Kolkata','Asia/Tokyo','Australia/Sydney'])])].sort();
  const regionalUS=zones.filter(zone=>otherUS.has(zone)||/^America\/(Indiana|Kentucky|North_Dakota)\//.test(zone));
  const prioritized=new Set([...commonUS,...regionalUS]);
  return [...prioritized,...zones.filter(zone=>!prioritized.has(zone))];
}
export function meetingClockTime(value,timeZone){
  return new Intl.DateTimeFormat('en-GB',{timeZone:resolveMeetingTimezone(timeZone),hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value));
}
// Refresh immediately after returning to the tab or waking the browser.
// Align ticks with the wall clock so delayed callbacks do not accumulate drift.
export function watchMeetingClock(onTick,{window:win=globalThis.window,cadence=1000}={}){
  let timer,active=true;
  const tick=()=>{
    win.clearTimeout(timer);if(!active)return;
    const now=Date.now();onTick(now);
    if(win.document.visibilityState!=='hidden')timer=win.setTimeout(tick,cadence-now%cadence);
  };
  win.addEventListener('focus',tick);win.document.addEventListener('visibilitychange',tick);tick();
  return()=>{active=false;win.clearTimeout(timer);win.removeEventListener('focus',tick);win.document.removeEventListener('visibilitychange',tick);};
}
export function meetingTimezoneLabel(timeZone,now=Date.now()){
  const zone=resolveMeetingTimezone(timeZone),offset=new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(new Date(now)).find(part=>part.type==='timeZoneName')?.value||'';
  return `${zone.replaceAll('_',' ')} · ${offset}`;
}
function parts(value,timeZone){
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:resolveMeetingTimezone(timeZone),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
}
export function localMeetingTime(value,timeZone){
  if(!value||!Number.isFinite(new Date(value).getTime()))return '';
  const p=parts(value,timeZone);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function meetingTimeToISO(value,timeZone,previous){
  if(/(?:Z|[+-]\d{2}:\d{2})$/.test(value||'')){
    const date=new Date(value);if(Number.isFinite(date.getTime()))return date.toISOString();
  }
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||''))throw Error('Choose a valid meeting date and time.');
  const wall=new Date(`${value}:00Z`).getTime();
  if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,16)!==value)throw Error('Choose a valid meeting date and time.');
  // Keep the original occurrence of an ambiguous clock time when it is unchanged.
  if(previous&&localMeetingTime(previous,timeZone)===value)return new Date(previous).toISOString();
  const candidates=new Set();
  for(const hours of [-36,0,36]){
    const instant=wall+hours*3600000,p=parts(instant,timeZone),offset=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-instant;
    const candidate=wall-offset;if(localMeetingTime(candidate,timeZone)===value)candidates.add(candidate);
  }
  if(!candidates.size)throw Error(`That time does not exist in ${resolveMeetingTimezone(timeZone)} because the clocks change. Choose another time.`);
  return new Date(Math.min(...candidates)).toISOString();
}
