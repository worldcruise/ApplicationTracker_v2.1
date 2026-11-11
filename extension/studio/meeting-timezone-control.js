import {meetingTimezones,meetingTimezoneLabel,resolveMeetingTimezone,meetingClockTime,watchMeetingClock} from './meeting-timezone.js';

export function createMeetingTimezoneControl(React){
  const h=React.createElement;
  return function MeetingTimezoneControl({value,onChange,disabled}){
    const [now,setNow]=React.useState(Date.now);
    React.useEffect(()=>watchMeetingClock(setNow),[]);
    const zone=resolveMeetingTimezone(value),minute=Math.floor(now/60000);
    const select=React.useMemo(()=>h('select',{className:'meetings-timezone','aria-label':'Meeting timezone',value,disabled,onChange:event=>onChange(event.target.value)},
      h('option',{value:'system'},`Browser: ${meetingTimezoneLabel('system',minute*60000)}`),
      ...meetingTimezones(value).map(option=>h('option',{key:option,value:option},option===value?meetingTimezoneLabel(option,minute*60000):option.replaceAll('_',' ')))),[value,onChange,disabled,minute]);
    return h('div',{className:'meetings-time-controls'},
      h('time',{className:'meetings-clock',dateTime:new Date(now).toISOString(),'aria-label':`Current time in ${zone}`,title:`Current time in ${zone.replaceAll('_',' ')}`},meetingClockTime(now,zone)),
      select);
  };
}
