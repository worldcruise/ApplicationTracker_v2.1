import {createUseWorkspaceSummary} from './workspace-summary.js';
import {applicationDocumentRecord} from './record-presentation.js';
import {MEETING_DETAILS_KEY,MEETING_GROUPS,previousMeetingHistory,applicationConversation,compareMeetingBoardRows,meetingRecordUpdate,projectMeetingRecords} from './meeting-model.js';
import {observeMeetingInitialScroll} from './meeting-scroll.js';
import {MEETING_TIMEZONE_KEY,resolveMeetingTimezone,watchMeetingClock} from './meeting-timezone.js';
import {createMeetingTimezoneControl} from './meeting-timezone-control.js';
import {createMeetingComponents} from './meeting-card.js';
import {createMeetingViews} from './meeting-views.js';
import {MEETING_VIEW_KEY,validMeetingView} from './meeting-views-model.js';
import {createWorkflowTools,openMeetingWorkflow} from './meeting-workflow-view.js';
import {ATTENTION_FOCUS_EVENT,attentionFocusRequest,finishAttentionFocus,waitForAttentionFocus} from './meeting-attention.js';

export function createMeetingsBoardPage(React, { Board }) {
  const h = React.createElement,useSummary=createUseWorkspaceSummary(React);
  const {MeetingCard,MeetingDialog}=createMeetingComponents(React);
  const MeetingTimezoneControl=createMeetingTimezoneControl(React);
  const WorkflowTools=createWorkflowTools(React);
  const {MeetingViewSwitcher,MeetingAlternateView,MeetingProgressSort}=createMeetingViews(React,{MeetingCard});
  return function MeetingsBoardPage({boardOnly=false}={}) {
    const {state:workspace}=useSummary();
    const [error,setError]=React.useState(''),pending=React.useRef(Promise.resolve());
    const [details,setDetails]=React.useState({}),[selected,setSelected]=React.useState(null),[now,setNow]=React.useState(Date.now);
    const [timezonePreference,setTimezonePreference]=React.useState('system'),[timezoneSaving,setTimezoneSaving]=React.useState(false),[timezoneError,setTimezoneError]=React.useState(''),timezoneWrite=React.useRef(false);
    const timeZone=resolveMeetingTimezone(timezonePreference);
    const host=React.useRef(null),[ready,setReady]=React.useState(false);
    const [view,setView]=React.useState(boardOnly?'board':'calendar'),viewWrite=React.useRef(Promise.resolve());
    const [progressSort,setProgressSort]=React.useState('next');
    const [focusRequest,setFocusRequest]=React.useState(0),requestedFocus=React.useRef(0);
    React.useEffect(()=>{const focus=()=>{const request=attentionFocusRequest();if(request&&!boardOnly){requestedFocus.current=request;setFocusRequest(request);setSelected(null);setView('calendar');}};window.addEventListener(ATTENTION_FOCUS_EVENT,focus);focus();return()=>window.removeEventListener(ATTENTION_FOCUS_EVENT,focus);},[]);
    React.useEffect(()=>{
      let alive=true;
      const changed=(changes,area)=>{if(!alive||area!=='local')return;if(changes[MEETING_DETAILS_KEY])setDetails(changes[MEETING_DETAILS_KEY].newValue||{});if(changes[MEETING_TIMEZONE_KEY]){setTimezonePreference(changes[MEETING_TIMEZONE_KEY].newValue||'system');setTimezoneError('');setNow(Date.now());}};
      chrome.storage.onChanged.addListener(changed);
      chrome.storage.local.get([MEETING_DETAILS_KEY,MEETING_TIMEZONE_KEY,MEETING_VIEW_KEY]).then(saved=>{
        if(!alive)return;setDetails(saved[MEETING_DETAILS_KEY]||{});setTimezonePreference(saved[MEETING_TIMEZONE_KEY]||'system');setView(boardOnly?'board':requestedFocus.current?'calendar':validMeetingView(saved[MEETING_VIEW_KEY]));setReady(true);
      }).catch(reason=>{if(alive)setError(reason.message);});
      const stopClock=watchMeetingClock(setNow,{cadence:30000});
      return()=>{alive=false;stopClock();chrome.storage.onChanged.removeListener(changed);};
    },[]);
    React.useEffect(()=>{if(ready&&host.current&&view==='board'&&!focusRequest)return observeMeetingInitialScroll(host.current);},[ready,view,focusRequest]);
    React.useEffect(()=>{if(ready&&host.current&&!boardOnly&&focusRequest===attentionFocusRequest()&&focusRequest)return waitForAttentionFocus(host.current,()=>finishAttentionFocus(focusRequest));},[ready,view,focusRequest]);
    function changeView(next){
      setView(next);setError('');
      viewWrite.current=viewWrite.current.then(()=>chrome.storage.local.set({[MEETING_VIEW_KEY]:next})).catch(reason=>setError(`Could not remember this view. ${reason.message}`));
    }
    async function changeTimezone(next){
      if(timezoneWrite.current)return;
      timezoneWrite.current=true;setTimezoneSaving(true);setTimezoneError('');
      try{await chrome.storage.local.set({[MEETING_TIMEZONE_KEY]:next});setTimezonePreference(next);setNow(Date.now());}
      catch(reason){setTimezoneError(`Could not save the timezone. ${reason.message}`);}
      finally{timezoneWrite.current=false;setTimezoneSaving(false);}
    }
    const complete=record=>record.historyOnly?record:projectMeetingRecords([record],details)[0];
    function saveMeeting(record,fields){
      const update=async()=>{const saved=(await chrome.storage.local.get(MEETING_DETAILS_KEY))[MEETING_DETAILS_KEY]||{},updated=meetingRecordUpdate({...record,meeting:saved[record.id]||record.meeting},fields),next={...saved,[record.id]:updated.meeting?{...updated.meeting,history:updated.meetingHistory||[]}:{updatedAt:updated.updatedAt,applicationStage:updated.status}};await chrome.storage.local.set({[MEETING_DETAILS_KEY]:next});setDetails(next);};
      const result=pending.current.then(update);pending.current=result.catch(()=>{});return result;
    }
    const current=selected&&complete(selected.record),records=selected?[...new Map([...(selected.records||[])].map(row=>[row.id,complete(row)])).values()]:[];
    return h('section', { className: 'meetings-page', 'aria-labelledby': boardOnly?undefined:'meetings-title','aria-label':boardOnly?'Application board':undefined },
      h('header', { className: 'meetings-heading' },
        !boardOnly&&h('h1', { id: 'meetings-title' }, 'Meetings'),
        h(MeetingTimezoneControl,{value:timezonePreference,onChange:changeTimezone,disabled:!ready||timezoneSaving}),!boardOnly&&h(WorkflowTools)),
      timezoneError&&h('p',{role:'alert',className:'meeting-error'},timezoneError),
      error&&h('p',{role:'alert'},error),
      !boardOnly&&h(MeetingViewSwitcher,{view,onChange:changeView,disabled:!ready}),
      h('div', { ref:host,className: 'meetings-application-board','data-view':view }, focusRequest&&!boardOnly?h('section',{className:'meeting-alert-review'},h('header',null,h('h2',null,'Today & needs action'),h('button',{type:'button',className:'web-button',onClick:()=>setFocusRequest(0)},'Back to calendar')),h('div',{className:'meeting-alert-list'},...(workspace?.alerts.items||[]).map(record=>h(MeetingCard,{key:record.id,record,onOpen:()=>setSelected({record,records:workspace.meetings.sourceRecords}),onUpdate:(record,initialAction)=>openMeetingWorkflow(document.body,{recordId:record.id,initialAction}),now,timeZone})))):ready&&h(Board,{view,boardOnly,onMeetingMove:(record,status)=>saveMeeting(complete(record),{status}),projectMeetingRecords,meetingDetails:details,meetingTimezone:timeZone,meetingSort:compareMeetingBoardRows,columnGroups:MEETING_GROUPS,
        filterTrailingControl:view==='progress'?h(MeetingProgressSort,{value:progressSort,onChange:setProgressSort}):null,
        renderMeetingView:({records,allRecords,sourceRecords,filters})=>h(MeetingAlternateView,{view,sort:progressSort,records:records.map(complete),allRecords:allRecords.map(complete),sourceRecords:sourceRecords.map(complete),filters,onUpdate:(row,initialAction)=>openMeetingWorkflow(document.body,{recordId:row.id,initialAction}),onOpen:record=>setSelected({record,records:sourceRecords,initialTab:view==='progress'?'details':undefined}),now,timeZone}),
        renderMeetingCard:(record,records)=>h(MeetingCard,{record:complete(record),onUpdate:(row,initialAction)=>openMeetingWorkflow(document.body,{recordId:row.id,initialAction}),onOpen:()=>setSelected({record,records}),now,timeZone})})),
      current&&h(MeetingDialog,{key:current.id,record:current,documentRecord:applicationDocumentRecord(current,workspace?.applications),readOnly:!!current.historyOnly,initialTab:selected.initialTab,history:previousMeetingHistory(current,records,now),conversation:applicationConversation(current,records),onClose:()=>setSelected(null),onSave:saveMeeting,onWorkflow:record=>{setSelected(null);openMeetingWorkflow(document.body,{recordId:record.id});},now,timeZone}));
  };
}
