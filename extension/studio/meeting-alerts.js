import {meetingNeedsAction} from './meeting-model.js';
import {localMeetingTime,resolveMeetingTimezone} from './meeting-timezone.js';

// Outcomes are application records. Only actual appointments can raise an alarm.
export function meetingAlert(record,timeZone,now=Date.now()){
  if(!['screen','interview'].includes(record.status)||['cancelled','draft','no_show'].includes(record.meeting?.lifecycle))return {today:false,needsAction:false};
  const zone=resolveMeetingTimezone(timeZone),start=localMeetingTime(record.meeting?.startsAt,zone);
  return {today:!!start&&Date.parse(record.meeting.startsAt)>=Number(now)&&start.slice(0,10)===localMeetingTime(now,zone).slice(0,10),needsAction:meetingNeedsAction(record.meeting||{},now)};
}
export function meetingAlerts(records,timeZone,now=Date.now()){
  const seen=new Set(),items=[];let today=0,needsAction=0;
  for(const record of records){
    if(seen.has(record.id))continue;seen.add(record.id);
    const flags=meetingAlert(record,timeZone,now);if(flags.today)today++;if(flags.needsAction)needsAction++;
    if(flags.today||flags.needsAction)items.push(record);
  }
  return {today,needsAction,total:items.length,items};
}
