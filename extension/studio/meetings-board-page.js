import {MEETING_SAMPLES_KEY,loadMeetingSamples} from './meeting-samples.js';
import {MEETING_DETAILS_KEY,MEETING_GROUPS,previousMeetings,applicationConversation,compareMeetingBoardRows,meetingRecordUpdate,projectMeetingRecords} from './meeting-model.js';
import {observeMeetingInitialScroll} from './meeting-scroll.js';
import {MEETING_TIMEZONE_KEY,resolveMeetingTimezone,watchMeetingClock} from './meeting-timezone.js';
import {createMeetingTimezoneControl} from './meeting-timezone-control.js';
import {createMeetingComponents} from './meeting-card.js';

export function createMeetingsBoardPage(React, { Board }) {
  const h = React.createElement;
  const {MeetingCard,MeetingDialog}=createMeetingComponents(React);
  const MeetingTimezoneControl=createMeetingTimezoneControl(React);
  return function MeetingsBoardPage() {
    const [samples,setSamples]=React.useState([]),[error,setError]=React.useState(''),pending=React.useRef(Promise.resolve());
    const [details,setDetails]=React.useState({}),[selected,setSelected]=React.useState(null),[now,setNow]=React.useState(Date.now);
    const [timezonePreference,setTimezonePreference]=React.useState('system'),[timezoneSaving,setTimezoneSaving]=React.useState(false),[timezoneError,setTimezoneError]=React.useState(''),timezoneWrite=React.useRef(false);
    const timeZone=resolveMeetingTimezone(timezonePreference);
    const host=React.useRef(null),[ready,setReady]=React.useState(false);
    React.useEffect(()=>{
      let alive=true;
      const changed=(changes,area)=>{if(!alive||area!=='local')return;if(changes[MEETING_SAMPLES_KEY])setSamples(changes[MEETING_SAMPLES_KEY].newValue||[]);if(changes[MEETING_DETAILS_KEY])setDetails(changes[MEETING_DETAILS_KEY].newValue||{});if(changes[MEETING_TIMEZONE_KEY]){setTimezonePreference(changes[MEETING_TIMEZONE_KEY].newValue||'system');setTimezoneError('');setNow(Date.now());}};
      chrome.storage.onChanged.addListener(changed);
      Promise.all([loadMeetingSamples(),chrome.storage.local.get([MEETING_DETAILS_KEY,MEETING_TIMEZONE_KEY])]).then(([rows,saved])=>{
        if(!alive)return;setSamples(rows);setDetails(saved[MEETING_DETAILS_KEY]||{});setTimezonePreference(saved[MEETING_TIMEZONE_KEY]||'system');setReady(true);
      }).catch(reason=>{if(alive)setError(reason.message);});
      const stopClock=watchMeetingClock(setNow,{cadence:30000});
      return()=>{alive=false;stopClock();chrome.storage.onChanged.removeListener(changed);};
    },[]);
    React.useEffect(()=>{if(ready&&host.current)return observeMeetingInitialScroll(host.current);},[ready]);
    async function changeTimezone(next){
      if(timezoneWrite.current)return;
      timezoneWrite.current=true;setTimezoneSaving(true);setTimezoneError('');
      try{await chrome.storage.local.set({[MEETING_TIMEZONE_KEY]:next});setTimezonePreference(next);setNow(Date.now());}
      catch(reason){setTimezoneError(`Could not save the timezone. ${reason.message}`);}
      finally{timezoneWrite.current=false;setTimezoneSaving(false);}
    }
    function updateMock(id,fields){
      const update=async()=>{
        const rows=await loadMeetingSamples(),next=id===null?[]:fields===null?rows.filter(row=>row.id!==id):rows.map(row=>row.id===id?meetingRecordUpdate(row,fields):row);
        await chrome.storage.local.set({[MEETING_SAMPLES_KEY]:next});setSamples(next);
      };
      const result=pending.current.then(update);pending.current=result.catch(()=>{});return result;
    }
    const complete=record=>projectMeetingRecords([{...record,...samples.find(sample=>sample.id===record.id)}],details)[0];
    function saveMeeting(record,fields){
      if(record.isMock)return updateMock(record.id,fields);
      const update=async()=>{const saved=(await chrome.storage.local.get(MEETING_DETAILS_KEY))[MEETING_DETAILS_KEY]||{},updated=meetingRecordUpdate({...record,meeting:saved[record.id]||record.meeting},fields),next={...saved,[record.id]:updated.meeting||{updatedAt:updated.updatedAt,applicationStage:updated.status}};await chrome.storage.local.set({[MEETING_DETAILS_KEY]:next});setDetails(next);};
      const result=pending.current.then(update);pending.current=result.catch(()=>{});return result;
    }
    const current=selected&&complete(selected.record),records=selected?[...new Map([...(selected.records||[]),...samples].map(row=>[row.id,complete(row)])).values()]:[];
    return h('section', { className: 'meetings-page', 'aria-labelledby': 'meetings-title' },
      h('header', { className: 'meetings-heading' },
        h('h1', { id: 'meetings-title' }, 'Meetings'),
        h(MeetingTimezoneControl,{value:timezonePreference,onChange:changeTimezone,disabled:!ready||timezoneSaving})),
      timezoneError&&h('p',{role:'alert',className:'meeting-error'},timezoneError),
      error&&h('p',{role:'alert'},error),
      h('div', { ref:host,className: 'meetings-application-board' }, ready&&h(Board,{mockRecords:samples,onMockUpdate:updateMock,onMeetingMove:(record,status)=>saveMeeting(complete(record),{status}),projectMeetingRecords,meetingDetails:details,meetingTimezone:timeZone,meetingSort:compareMeetingBoardRows,columnGroups:MEETING_GROUPS,renderMeetingCard:(record,records)=>h(MeetingCard,{record:complete(record),onOpen:()=>setSelected({record,records}),now,timeZone})})),
      current&&h(MeetingDialog,{key:current.id,record:current,history:previousMeetings(current,records,now),conversation:applicationConversation(current,records),onClose:()=>setSelected(null),onSave:saveMeeting,now,timeZone}));
  };
}
