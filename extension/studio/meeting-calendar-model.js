import {meetingMonthDays,shiftMeetingMonth,meetingDayRange,meetingDayLabel} from './meeting-views-model.js';
import {localMeetingTime} from './meeting-timezone.js';

export const CALENDAR_MODE_KEY='meeting-calendar-view:v1';
export const CALENDAR_MODES=[['day','Day'],['week','Week'],['month','Month']];
export const validCalendarMode=value=>CALENDAR_MODES.some(([key])=>key===value)?value:'month';
export const shiftCalendarDay=(day,amount)=>new Date(Date.parse(`${day}T12:00:00Z`)+amount*86400000).toISOString().slice(0,10);
export const calendarMinute=(instant,timeZone)=>{
  const time=localMeetingTime(instant,timeZone).slice(11);
  return time?Number(time.slice(0,2))*60+Number(time.slice(3,5)):0;
};

export function calendarPeriodDays(day,mode){
  if(mode==='month')return meetingMonthDays(day.slice(0,7));
  if(mode==='day')return [day];
  const first=shiftCalendarDay(day,-new Date(`${day}T12:00:00Z`).getUTCDay());
  return Array.from({length:7},(_,index)=>shiftCalendarDay(first,index));
}
export function shiftCalendarDate(day,mode,amount){
  if(mode!=='month')return shiftCalendarDay(day,amount*(mode==='week'?7:1));
  const month=shiftMeetingMonth(day.slice(0,7),amount),last=Number(shiftCalendarDay(`${shiftMeetingMonth(month,1)}-01`,-1).slice(-2));
  return `${month}-${String(Math.min(Number(day.slice(-2)),last)).padStart(2,'0')}`;
}
export function calendarPeriodLabel(day,mode){
  if(mode==='day')return meetingDayLabel(day,{year:'numeric'});
  const format=new Intl.DateTimeFormat(undefined,{timeZone:'UTC',month:mode==='month'?'long':'short',year:'numeric',...mode==='week'?{day:'numeric'}:{}});
  if(mode==='month')return format.format(new Date(`${day}T12:00:00Z`));
  const days=calendarPeriodDays(day,mode);
  return format.formatRange(new Date(`${days[0]}T12:00:00Z`),new Date(`${days.at(-1)}T12:00:00Z`));
}

// Each date uses a local 24-hour axis. Midnight endings belong only to the previous day.
export function calendarTimeSegments(records,day,timeZone){
  const segments=[];
  for(const record of records){
    const {from,to}=meetingDayRange(record,timeZone);
    if(!from||from>day||to<day)continue;
    const start=from<day?0:calendarMinute(record.meeting.startsAt,timeZone);
    const endStamp=localMeetingTime(record.meeting.endsAt,timeZone);
    let end=!endStamp?start+30:endStamp.slice(0,10)>day?1440:calendarMinute(record.meeting.endsAt,timeZone);
    // A clock rollback can put the end label before its start on the local axis.
    // Keep such an event visible using elapsed duration; its label retains the actual times.
    if(end<=start)end=start+Math.max(1,(Date.parse(record.meeting.endsAt)-Date.parse(record.meeting.startsAt))/60000||30);
    end=Math.min(1440,end);
    const displayStart=Math.min(start,1416),displayEnd=Math.min(1440,Math.max(end,displayStart+24));
    segments.push({record,start,end,displayStart,displayEnd,continuesBefore:from<day,continuesAfter:to>day});
  }
  segments.sort((a,b)=>a.displayStart-b.displayStart||b.displayEnd-a.displayEnd||a.record.id.localeCompare(b.record.id));
  let group=[],groupEnd=-1,lanes=[];
  function finish(){for(const segment of group)segment.columns=lanes.length;group=[];lanes=[];}
  for(const segment of segments){
    if(segment.displayStart>=groupEnd){finish();groupEnd=-1;}
    let column=lanes.findIndex(end=>end<=segment.displayStart);
    if(column===-1)column=lanes.length;
    lanes[column]=segment.displayEnd;segment.column=column;group.push(segment);groupEnd=Math.max(groupEnd,segment.displayEnd);
  }
  finish();return segments;
}
