import {localMeetingTime,meetingTimeToISO,resolveMeetingTimezone} from './meeting-timezone.js';

export const APPLICATION_PERIODS=[['all','All'],['month','This month'],['week','Last week'],['3days','Last 3 days'],['24hours','Last 24 hr']];

export function applicationDateBounds(filters,now=Date.now()){
  const timeZone=resolveMeetingTimezone(filters.timezone),period=filters.period||'all';
  if(period==='month'){
    const month=localMeetingTime(now,timeZone).slice(0,7);
    return {from:Date.parse(meetingTimeToISO(`${month}-01T00:00`,timeZone)),to:Number(now)};
  }
  const hours={week:168,'3days':72,'24hours':24}[period];
  if(hours)return {from:Number(now)-hours*3600000,to:Number(now)};
  const midnight=day=>Date.parse(meetingTimeToISO(`${day}T00:00`,timeZone));
  const nextDay=day=>new Date(Date.parse(`${day}T12:00:00Z`)+86400000).toISOString().slice(0,10);
  return {from:filters.startDate?midnight(filters.startDate):-Infinity,to:filters.endDate?midnight(nextDay(filters.endDate))-1:Infinity};
}

export function matchesApplicationDate(value,filters,now=Date.now(),endValue=value){
  if((!filters.period||filters.period==='all')&&!filters.startDate&&!filters.endDate)return true;
  const start=Date.parse(value),end=Date.parse(endValue),{from,to}=applicationDateBounds(filters,now);
  return Number.isFinite(start)&&start<=to&&(Number.isFinite(end)?Math.max(start,end):start)>=from;
}
