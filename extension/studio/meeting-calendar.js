import {meetingDay,meetingDayLabel,meetingDayAgendas,calendarMeetingData} from './meeting-views-model.js';
import {CALENDAR_MODE_KEY,CALENDAR_MODES,validCalendarMode,calendarPeriodDays,calendarPeriodLabel,shiftCalendarDate,calendarMinute,calendarTimeSegments} from './meeting-calendar-model.js';
import {meetingColors,meetingRange,meetingIsPast} from './meeting-model.js';

export function createMeetingCalendar(React,{MeetingCard,icon}){
  const h=React.createElement,hours=Array.from({length:24},(_,hour)=>`${String(hour).padStart(2,'0')}:00`);
  function TimeGrid({days,agendas,selected,onSelect,onOpen,now,timeZone,mode}){
    const scroller=React.useRef(null),today=meetingDay(now,timeZone),minute=calendarMinute(now,timeZone);
    const columns=days.map(day=>({day,segments:calendarTimeSegments(agendas.get(day)||[],day,timeZone)}));
    const period=days.join(',');
    React.useEffect(()=>{
      const first=Math.min(...columns.flatMap(column=>column.segments.map(segment=>segment.start)));
      const focus=days.includes(today)?minute:Number.isFinite(first)?first:480;
      if(scroller.current)scroller.current.scrollTop=Math.max(0,(focus-60)*64/60);
      // Period/zone changes reposition the grid; clock ticks and edits preserve user scrolling.
    },[period,timeZone]);
    return h('div',{ref:scroller,className:'meeting-time-grid','data-calendar-mode':mode,style:{'--calendar-days':days.length},tabIndex:0,'aria-label':`${mode==='week'?'Weekly':'Daily'} calendar, ${timeZone}`},
      h('div',{className:'meeting-time-header'},h('span',{className:'meeting-time-corner'},'24h'),...days.map(day=>h('button',{key:day,type:'button',className:'meeting-time-date','data-day':day,'data-today':String(day===today),'aria-pressed':day===selected,'aria-current':day===today?'date':undefined,'aria-label':`Show ${meetingDayLabel(day,{year:'numeric'})} in day view`,onClick:()=>onSelect(day)},
        h('span',null,meetingDayLabel(day,{weekday:'short',month:undefined,day:undefined})),h('strong',null,Number(day.slice(-2)))))),
      h('div',{className:'meeting-time-body'},
        h('div',{className:'meeting-time-axis','aria-hidden':true},...hours.map((label,hour)=>h('span',{key:label,style:{top:`${hour*64}px`}},label))),
        ...columns.map(({day,segments})=>h('div',{key:day,className:'meeting-time-column','data-day':day,'data-today':String(day===today),'data-weekend':String([0,6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()))},
          ...segments.map(segment=>{
            const {record,start,end,displayStart,displayEnd,column,columns}=segment,colors=meetingColors(record),range=meetingRange(record.meeting,timeZone,true);
            const label=`${record.companyName} · ${record.jobTitle} · ${range.date} · ${range.time}${segment.continuesBefore?' · Continues from previous day':''}${segment.continuesAfter?' · Continues into next day':''}`;
            return h('button',{key:record.id,type:'button',className:'meeting-time-event','data-calendar-meeting':record.id,'data-past':String(meetingIsPast(record.meeting,now)),'data-start-minute':start,'data-end-minute':end,'data-columns':columns,'data-compact':String(displayEnd-displayStart<40),'aria-label':label,title:label,onClick:()=>onOpen(record),style:{top:`${displayStart*64/60}px`,height:`${(displayEnd-displayStart)*64/60}px`,left:`calc(${column/columns*100}% + 2px)`,width:`calc(${100/columns}% - 4px)`,'--meeting-bg':colors.background,'--meeting-ink':colors.ink,'--meeting-accent':colors.accent}},
              h('strong',null,record.companyName||'Company not specified'),h('time',{dateTime:record.meeting.startsAt},`${segment.continuesBefore?'← ':''}${range.time}${segment.continuesAfter?' →':''}`),h('span',null,record.jobTitle));
          }),
          day===today&&h('div',{className:'meeting-time-now',style:{top:`${minute*64/60}px`},role:'img','aria-label':`Current time ${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`})))));
  }
  return function CalendarView({allRecords,sourceRecords,filters,onOpen,onUpdate,now,timeZone}){
    const today=meetingDay(now,timeZone),[selected,setSelected]=React.useState(today),[mode,setMode]=React.useState('month');
    const [ready,setReady]=React.useState(false),[error,setError]=React.useState(''),writes=React.useRef(Promise.resolve()),modeChosen=React.useRef(false);
    React.useEffect(()=>{
      let alive=true;
      chrome.storage.local.get(CALENDAR_MODE_KEY).then(saved=>{if(alive&&!modeChosen.current)setMode(validCalendarMode(saved[CALENDAR_MODE_KEY]));}).catch(()=>{}).finally(()=>{if(alive)setReady(true);});
      return()=>{alive=false;};
    },[]);
    function changeMode(next){
      modeChosen.current=true;setMode(next);setError('');
      writes.current=writes.current.then(()=>chrome.storage.local.set({[CALENDAR_MODE_KEY]:next})).catch(reason=>setError(`Could not remember the calendar view. ${reason.message}`));
    }
    function openDay(day){setSelected(day);changeMode('day');}
    const {events,unscheduled}=calendarMeetingData(allRecords,sourceRecords,filters,timeZone,now);
    const days=calendarPeriodDays(selected,mode),agendas=meetingDayAgendas(events,days,timeZone),agenda=agendas.get(selected)||[];
    const month=selected.slice(0,7),title=calendarPeriodLabel(selected,mode);
    return h('section',{className:'meeting-calendar-view','aria-label':'Calendar view','data-calendar-mode':mode},
      h('header',{className:'meeting-view-heading meeting-calendar-toolbar'},
        h('div',{className:'meeting-calendar-navigation'},
          h('button',{type:'button',className:'web-button',onClick:()=>setSelected(today)},'Today'),
          h('button',{type:'button',className:'web-button meeting-calendar-arrow','aria-label':`Previous ${mode}`,onClick:()=>setSelected(day=>shiftCalendarDate(day,mode,-1))},icon('previous')),
          h('button',{type:'button',className:'web-button meeting-calendar-arrow','aria-label':`Next ${mode}`,onClick:()=>setSelected(day=>shiftCalendarDate(day,mode,1))},icon('next'))),
        h('h2',{'aria-live':'polite'},title),
        h('nav',{className:'meeting-calendar-modes','aria-label':'Calendar time range'},...CALENDAR_MODES.map(([key,label])=>h('button',{key,type:'button',disabled:!ready,'data-calendar-mode-button':key,'aria-pressed':mode===key,onClick:()=>changeMode(key)},label)))),
      error&&h('p',{role:'alert',className:'meeting-error'},error),
      h('div',{className:'meeting-calendar-layout','data-calendar-mode':mode},
        mode==='month'?h('div',{className:'meeting-calendar-month',role:'group','aria-label':title},
          h('div',{className:'meeting-calendar-weekdays'},...['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>h('span',{key:day},day))),
          h('div',{className:'meeting-calendar-grid'},...days.map(day=>{
            const appointments=agendas.get(day);
            return h('div',{key:day,className:'meeting-calendar-day','data-day':day,'data-outside':String(!day.startsWith(month)),'data-selected':String(day===selected),'data-today':String(day===today)},
              h('button',{type:'button',className:'meeting-calendar-date','aria-label':`${meetingDayLabel(day,{year:'numeric'})}, ${appointments.length} meetings`,'aria-pressed':day===selected,'aria-current':day===today?'date':undefined,onClick:()=>setSelected(day)},h('span',null,Number(day.slice(-2))),!!appointments.length&&h('small',null,appointments.length)),
              ...appointments.slice(0,3).map(event=>{const colors=meetingColors(event),range=meetingRange(event.meeting,timeZone,true);return h('button',{key:event.id,type:'button',className:'meeting-calendar-event','data-calendar-meeting':event.id,onClick:()=>onOpen(event),style:{'--meeting-bg':colors.background,'--meeting-ink':colors.ink},title:`${event.companyName} · ${event.jobTitle} · ${range.time}`},h('time',{dateTime:event.meeting.startsAt},range.time),h('span',null,event.companyName));}),
              appointments.length>3&&h('button',{type:'button',className:'meeting-calendar-more',onClick:()=>setSelected(day)},`+${appointments.length-3} more`));
          }))):h(TimeGrid,{key:mode,days,agendas,selected,onSelect:openDay,onOpen,now,timeZone,mode}),
        h('aside',{className:'meeting-calendar-agenda','aria-label':'Selected day meetings'},
          h('header',null,h('h3',null,meetingDayLabel(selected)),h('span',null,`${agenda.length} ${agenda.length===1?'meeting':'meetings'}`),mode!=='day'&&h('button',{type:'button',className:'meeting-calendar-open-day',onClick:()=>openDay(selected)},'Open day')),
          agenda.length?h('div',{className:'meeting-agenda-cards'},...agenda.map(record=>h(MeetingCard,{key:record.id,record,onOpen,onUpdate:record.historyOnly?undefined:onUpdate,now,timeZone}))):h('p',{className:'meeting-empty'},'No meetings on this day.'),
          !!unscheduled.length&&h('details',{className:'meeting-unscheduled'},h('summary',null,`Not scheduled (${unscheduled.length})`),...unscheduled.map(record=>h(MeetingCard,{key:record.id,record,onOpen,now,timeZone}))))));
  };
}
