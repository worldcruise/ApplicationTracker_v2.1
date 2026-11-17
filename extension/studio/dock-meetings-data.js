import {MEETING_DETAILS_KEY,projectMeetingRecords,compareMeetingBoardRows} from './meeting-model.js';
import {MEETING_TIMEZONE_KEY,resolveMeetingTimezone,localMeetingTime} from './meeting-timezone.js';
import {withRequestDeadline} from './request-deadline.js';

export const MEETING_EVENTS_KEY='application-meetings:v1';
export const DOCK_MEETING_KEYS=['appliedList',MEETING_EVENTS_KEY,MEETING_DETAILS_KEY,MEETING_TIMEZONE_KEY];
// Preserve the web application's IDs for older records without a server ID.
export function meetingSourceRows(records){
  const counts=new Map();
  return records.map(record=>{
    const key=encodeURIComponent([record.jobTitle,record.jobLink,record.companyLink,record.date,record.profileName].join('\0')),index=counts.get(key)||0;
    counts.set(key,index+1);return {...record,id:record.id??`local:${index}:${key}`};
  });
}
export async function readDockMeetings(browser){
  const saved=await browser.storage.local.get(['appliedList',MEETING_EVENTS_KEY,MEETING_DETAILS_KEY,MEETING_TIMEZONE_KEY]);
  if(saved.appliedList&&!Array.isArray(saved.appliedList))throw Error('The saved applications could not be read.');
  const applications=meetingSourceRows(saved.appliedList||[]),ids=new Set(applications.map(row=>row.id));
  const events=(saved[MEETING_EVENTS_KEY]||[]).filter(row=>ids.has(row.applicationId)),scheduled=new Set(events.map(row=>row.applicationId));
  const sources=[...applications.filter(row=>!scheduled.has(row.id)||['offer','rejected','archived'].includes(row.status)),...events];
  const sourceRecords=sources.map(row=>projectMeetingRecords([row],saved[MEETING_DETAILS_KEY]||{})[0]);
  return {records:projectMeetingRecords(sourceRecords).filter(row=>['screen','interview'].includes(row.status)).sort(compareMeetingBoardRows),sourceRecords,timeZone:resolveMeetingTimezone(saved[MEETING_TIMEZONE_KEY])};
}
export function getDockMeetings(browser,timeoutMs=10000){
  return withRequestDeadline(browser.meetings?browser.meetings.read():readDockMeetings(browser),timeoutMs,'Meetings did not respond. Retry, or reopen the extension to reconnect.');
}
export function meetingsToday(state,now=Date.now()){
  const day=localMeetingTime(now,state.timeZone).slice(0,10);
  return state.records.filter(row=>localMeetingTime(row.meeting?.startsAt,state.timeZone).slice(0,10)===day).length;
}
