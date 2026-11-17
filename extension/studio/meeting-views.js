import {createMeetingCalendar} from './meeting-calendar.js';
import {MEETING_VIEWS,MEETING_PROGRESS_SORTS,meetingProgressData,sortMeetingProgress} from './meeting-views-model.js';
import {meetingRange,MEETING_STATUS_LABELS} from './meeting-model.js';

export function createMeetingViews(React,{MeetingCard}){
  const h=React.createElement;
  const icon=name=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:{board:'M3 3h7v18H3zM14 3h7v11h-7z',calendar:'M3 5h18v16H3zM7 3v4M17 3v4M3 10h18',progress:'M3 4h18v16H3zM3 9h18M9 4v16',previous:'m15 5-7 7 7 7',next:'m9 5 7 7-7 7'}[name]}));
  function MeetingViewSwitcher({view,onChange,disabled}){
    return h('nav',{className:'meeting-view-switcher','aria-label':'Meeting views'},...MEETING_VIEWS.map(([key,label])=>h('button',{key,type:'button',disabled,'data-meeting-view':key,'aria-pressed':view===key,onClick:()=>onChange(key)},icon(key),label)));
  }
  const CalendarView=createMeetingCalendar(React,{MeetingCard,icon});
  const resultLabels=Object.fromEntries(['passed','upcoming','pending','needs_action','failed'].map(key=>[key,MEETING_STATUS_LABELS[key]]));
  function MeetingProgressSort({value,onChange}){
    return h('label',{className:'meeting-progress-sort'},'Sort by',h('select',{'aria-label':'Sort progress',value,onChange:event=>onChange(event.target.value)},...MEETING_PROGRESS_SORTS.map(([key,label])=>h('option',{key,value:key},label))));
  }
  function ProgressView({records,sourceRecords,onOpen,now,timeZone,sort='next'}){
    const data=meetingProgressData(records,sourceRecords,now),rows=sortMeetingProgress(data.rows,sort,now);
    return h('section',{className:'meeting-progress-view','aria-label':'Progress view'},
      h('header',{className:'meeting-progress-heading'},h('p',null,`${rows.length} active ${rows.length===1?'application':'applications'}`),
        h('div',{className:'meeting-progress-legend'},...Object.entries(resultLabels).filter(([key])=>['passed','upcoming','pending'].includes(key)).map(([key,label])=>h('span',{key,className:'meeting-tag meeting-result','data-result':key},label)))),
      h('div',{className:'meeting-progress-table-wrap',tabIndex:0,'aria-label':'Application progress table'},
        h('table',{className:'meeting-progress-table'},
          h('caption',{className:'sr-only'},'Active applications from screening through interview Round 6'),
          h('thead',null,h('tr',null,...['Company','Role','Screening',...Array.from({length:6},(_,i)=>`Round ${i+1}`)].map(label=>h('th',{key:label,scope:'col'},label)))),
          h('tbody',null,...rows.map(({record,steps})=>h('tr',{key:record.applicationId||record.id,'data-application-id':record.applicationId||record.id},
            h('th',{scope:'row'},h('button',{type:'button',className:'meeting-progress-open',onClick:()=>onOpen(record)},record.companyName||'Company not specified')),
            h('td',{className:'meeting-progress-role'},h('button',{type:'button',className:'meeting-progress-role-open',onClick:()=>onOpen(record)},record.jobTitle||'Role not specified')),
            ...steps.map(step=>{
              const label=resultLabels[step.result],range=step.event&&meetingRange(step.event.meeting,timeZone,true);
              return h('td',{key:step.label},label&&step.event?h('button',{type:'button',className:'meeting-progress-step','data-result':step.result,'data-progress-meeting-id':step.event.id,onClick:()=>onOpen(step.event),'aria-label':`${record.companyName}, ${step.label}: ${label}, ${range.date} ${range.time}`},
                h('span',{className:'meeting-tag meeting-result','data-result':step.result},label),h('time',{dateTime:step.event.meeting.startsAt},range.date),h('span',null,range.time),step.sessions>1&&h('small',null,`${step.sessions} meetings`)):h('span',{className:'meeting-progress-empty','aria-label':'Not scheduled'},'—'));
            }))),!rows.length&&h('tr',null,h('td',{colSpan:9,className:'meeting-empty'},'No active applications match your filters.'))))));
  }
  function MeetingAlternateView(props){
    return props.view==='calendar'?h(CalendarView,props):props.view==='progress'?h(ProgressView,props):null;
  }
  return {MeetingViewSwitcher,MeetingAlternateView,MeetingProgressSort};
}
