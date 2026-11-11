import {meetingColors,meetingRound,meetingDate,meetingRange,meetingIsPast,meetingLink,localMeetingTime,validateMeeting,isApplicationRecord,MEETING_TOPIC_TAGS,meetingStatus,MEETING_STATUS_LABELS,recordUpdatedAt} from './meeting-model.js';
import {meetingTimeToISO} from './meeting-timezone.js';

export function createMeetingComponents(React){
  const h=React.createElement;
  const stages={offer:'Offer',rejected:'Rejected',archived:'Failed'};
  const icon=name=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},
    h('path',{d:{phone:'M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C10 21 3 14 3 5a2 2 0 0 1 2-2Z',video:'M3 5h12v14H3zM15 9l6-3v12l-6-3',external:'M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7',close:'M6 6l12 12M18 6 6 18'}[name]}));
  function Tags({record,now}){
    if(isApplicationRecord(record))return h('div',{className:'meeting-tags'},h('span',{className:'meeting-tag'},stages[record.status]));
    const meeting=record.meeting||{};
    return h('div',{className:'meeting-tags'},
      h('span',{className:'meeting-tag meeting-result','data-result':meetingStatus(meeting,now)},MEETING_STATUS_LABELS[meetingStatus(meeting,now)]),
      meeting.mode&&!(record.status==='interview'&&meeting.mode==='video')&&h('span',{className:'meeting-tag'},icon(meeting.mode),meeting.mode==='phone'?'Phone':'Video'),
      record.status==='interview'&&h('span',{className:'meeting-tag meeting-round'},`Round ${meetingRound(meeting.round)}`),
      ...MEETING_TOPIC_TAGS.filter(([key])=>meeting.topics?.includes(key)).map(([key,label])=>h('span',{key,className:'meeting-tag'},label)),
      meeting.rescheduled&&h('span',{className:'meeting-tag meeting-rescheduled'},'Rescheduled'));
  }
  function MeetingCard({record,onOpen,now,timeZone}){
    const outcome=isApplicationRecord(record),meeting=record.meeting||{},date=outcome?meetingDate(recordUpdatedAt(record),timeZone,true):meetingRange(meeting,timeZone,true),past=meetingIsPast(meeting,now),colors=meetingColors(record),link=meetingLink(meeting.joinUrl);
    const label=outcome?'View application record':past?'View transcript and chat history':meeting.mode==='phone'?'View phone number':'View meeting details';
    return h('article',{className:'meeting-card','data-entity-type':outcome?'application':'meeting','data-meeting-id':record.id,'data-mock':record.isMock?'true':undefined,'data-past':outcome?undefined:String(past),'data-mode':outcome?undefined:meeting.mode,'data-status':record.status,'data-round':record.status==='interview'?meetingRound(meeting.round):undefined,'data-starts-at':outcome?undefined:meeting.startsAt,'data-ends-at':outcome?undefined:meeting.endsAt,'data-lifecycle':meeting.lifecycle,style:{'--meeting-bg':colors.background,'--meeting-ink':colors.ink,'--meeting-accent':colors.accent}},
      h('button',{type:'button',className:'meeting-card-main',onClick:()=>onOpen(record),'aria-label':`${label} · ${record.companyName} · ${record.jobTitle}`},
        h('span',{className:'meeting-card-heading'},
          h('span',{className:'meeting-company'},record.companyName||'Company not specified'),
          h('span',{className:'meeting-role'},record.jobTitle?.replace(/^Mock · /,'')||'Role not specified'),
          h('time',{className:'meeting-time',dateTime:(outcome?recordUpdatedAt(record):meeting.startsAt)||undefined,'aria-label':outcome?'Last updated':undefined},outcome&&h('span',{className:'meeting-updated-label'},'Updated'),h('span',null,outcome&&!date.time?'Not recorded':date.date),date.time&&h('span',null,date.time))),
        h(Tags,{record,now})),
      !outcome&&!past&&meeting.mode==='video'&&link&&h('a',{className:'meeting-icon-link meeting-card-action',href:link,target:'_blank',rel:'noopener noreferrer',title:record.isMock?'Open demo meeting link':'Join video meeting','aria-label':record.isMock?'Open demo meeting link':'Join video meeting'},icon('external')));
  }
  const person=contact=>typeof contact==='string'?contact:[contact?.name,contact?.email&&`<${contact.email}>`].filter(Boolean).join(' ')||'Unknown sender';
  function Conversation({conversation,timeZone}){
    const {messages=[],fragments=[]}=conversation||{};let previousDay='';
    return h('section',{className:'meeting-conversation','aria-label':'Application chat history'},
      !messages.length&&!fragments.length&&h('p',{className:'meeting-empty'},'No chat history saved yet.'),
      ...messages.map(message=>{
        const stamp=localMeetingTime(message.sentAt,timeZone),day=stamp?.slice(0,10)||'Unknown date',separator=day!==previousDay;previousDay=day;
        return h(React.Fragment,{key:message.id},separator&&h('p',{className:'meeting-chat-date'},`----- ${day} -----`),
          h('article',{className:'meeting-chat-message'},h('header',null,h('strong',null,person(message.sender)),', ',h('time',{dateTime:message.sentAt},stamp?.replace('T',' ')||'Date not recorded')),
            h('p',{className:'meeting-chat-to'},'To: ',(message.recipients||[]).map(person).join(', ')||'Not recorded'),h('p',{className:'meeting-chat-body'},message.body)));
      }),
      !!fragments.length&&h('h3',{className:'meeting-imported-heading'},'Undated imported history'),
      ...fragments.map(fragment=>h('p',{key:fragment.id,className:'meeting-chat-body meeting-imported'},fragment.text)));
  }
  function PreviousMeetings({records,timeZone}){
    const [selected,setSelected]=React.useState(records.at(-1)?.id),active=records.find(row=>row.id===selected)||records.at(-1);
    if(!active)return h('p',{className:'meeting-empty'},'No previous meetings for this application yet.');
    const meeting=active.meeting,date=meetingRange(meeting,timeZone);
    return h('section',{'aria-label':'Previous meetings'},
      h('div',{className:'meeting-history-tabs meeting-previous-tabs','aria-label':'Choose a previous meeting'},...records.map(row=>h('button',{key:row.id,type:'button','aria-pressed':row.id===active.id,onClick:()=>setSelected(row.id)},row.status==='screen'?'Screening':`Round ${meetingRound(row.meeting.round)}`,h('small',null,meetingDate(row.meeting.startsAt,timeZone,true).date)))),
      h('div',{className:'meeting-summary'},h('time',{dateTime:meeting.startsAt},`${date.date} · ${date.time}`),h(Tags,{record:active}),h('p',null,h('strong',null,'Interviewer: '),meeting.interviewer||'Not specified')),
      h('section',{className:'meeting-history','aria-label':'Previous meeting transcript'},h('p',null,meeting.transcript||'No transcript saved yet.')));
  }
  function MeetingDialog({record,onClose,onSave,now,timeZone,history=[],conversation}){
    const outcome=isApplicationRecord(record),meeting=record.meeting||{},past=meetingIsPast(meeting,now),date=meetingRange(meeting,timeZone),link=meetingLink(meeting.joinUrl);
    const ref=React.useRef(null),[editing,setEditing]=React.useState(false),[tab,setTab]=React.useState(!outcome&&past?'transcript':'details'),[saving,setSaving]=React.useState(false),[error,setError]=React.useState(''),[draft,setDraft]=React.useState(null),[editZone,setEditZone]=React.useState(timeZone);
    React.useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>previous?.isConnected&&previous.focus();},[]);
    React.useEffect(()=>{
      if(!editing||!draft||timeZone===editZone)return;
      try{
        const convert=(value,previous)=>localMeetingTime(meetingTimeToISO(value,editZone,previous),timeZone);
        setDraft({...draft,startsAt:convert(draft.startsAt,meeting.startsAt),endsAt:convert(draft.endsAt,meeting.endsAt)});setEditZone(timeZone);
      }catch{setError(`Complete the date and time fields before switching this edit from ${editZone}.`);}
    },[timeZone,editing]);
    function edit(){
      setEditZone(timeZone);setDraft({jobTitle:record.jobTitle,companyName:record.companyName,startsAt:localMeetingTime(meeting.startsAt,timeZone),endsAt:localMeetingTime(meeting.endsAt,timeZone),mode:meeting.mode||'video',round:meetingRound(meeting.round),result:meetingStatus(meeting,now),topics:meeting.topics||[],interviewer:meeting.interviewer||'',rescheduled:!!meeting.rescheduled,phone:meeting.phone||'',joinUrl:meeting.joinUrl||'',transcript:meeting.transcript||'',chatHistory:meeting.chatHistory||''});setError('');setEditing(true);
    }
    function field(name,label,type='text',extra={}){
      return h('label',{className:'meeting-field',key:name},h('span',null,label),h(type==='textarea'?'textarea':'input',{name,type:type==='textarea'?undefined:type,value:draft[name],onChange:event=>setDraft({...draft,[name]:event.target.value}),...extra}));
    }
    async function save(event){
      event.preventDefault();setSaving(true);setError('');
      try{
        const {jobTitle,companyName,...fields}=draft;if(!jobTitle.trim()||!companyName.trim())throw Error('Company and job title are required.');
        await onSave(record,{jobTitle:jobTitle.trim(),companyName:companyName.trim(),meeting:{...meeting,...validateMeeting(fields,editZone,meeting)}});setEditing(false);setTab('details');
      }catch(reason){setError(reason.message);}finally{setSaving(false);}
    }
    const tabs=[['details',outcome?'Application':'Details'],...!outcome&&past?[['transcript','Transcript']]:[],...record.status==='interview'||outcome?[['previous','Previous meetings']]:[],['chat','Chat history']];
    return h('dialog',{ref,className:'meeting-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'meeting-dialog-title',onCancel:event=>{event.preventDefault();if(!saving)onClose();}},
      h('header',{className:'meeting-dialog-heading'},h('div',null,h('p',null,record.companyName),h('h2',{id:'meeting-dialog-title'},record.jobTitle?.replace(/^Mock · /,''))),h('button',{type:'button',className:'meeting-close',onClick:onClose,disabled:saving,'aria-label':outcome?'Close application':'Close meeting'},icon('close'))),
      h('div',{className:'meeting-dialog-body'},
        record.isMock&&h('p',{className:'meeting-mock-note'},'Demo data · Example contact details, links and conversation.'),
        error&&h('p',{role:'alert',className:'meeting-error'},error),
        editing?h('form',{onSubmit:save,id:'meeting-edit-form',className:'meeting-edit-form'},
          field('companyName','Company','text',{required:true,readOnly:!record.isMock,maxLength:300}),field('jobTitle','Job title','text',{required:true,readOnly:!record.isMock,maxLength:500}),
          h('div',{className:'meeting-time-fields'},field('startsAt','Start','datetime-local',{required:true}),field('endsAt','End','datetime-local',{required:true})),
          h('label',{className:'meeting-field'},h('span',null,'Meeting status'),h('select',{name:'result',value:draft.result,onChange:event=>setDraft({...draft,result:event.target.value})},...Object.entries(MEETING_STATUS_LABELS).map(([value,label])=>h('option',{key:value,value},label)))),
          h('p',{className:'meeting-help'},'Upcoming changes to Pending when the meeting starts. Record Passed or Failed after it ends. Failed keeps the interview history in the Failed column.'),
          h('label',{className:'meeting-field'},h('span',null,'Meeting type'),h('select',{name:'mode',value:draft.mode,onChange:event=>setDraft({...draft,mode:event.target.value})},h('option',{value:'phone'},'Phone'),h('option',{value:'video'},'Video'))),
          (record.status==='interview'||meeting.kind==='interview')&&field('round','Interview round','number',{min:1,max:6,required:true}),field('interviewer','Interviewer','text',{maxLength:200}),
          h('fieldset',{className:'meeting-tag-options'},h('legend',null,'Tags'),h('label',{className:'meeting-checkbox'},h('input',{type:'checkbox',checked:draft.rescheduled,onChange:event=>setDraft({...draft,rescheduled:event.target.checked})}),'Rescheduled'),
            ...MEETING_TOPIC_TAGS.map(([key,label])=>h('label',{key,className:'meeting-checkbox'},h('input',{type:'checkbox',name:'topics',value:key,checked:draft.topics.includes(key),onChange:event=>setDraft({...draft,topics:event.target.checked?[...draft.topics,key]:draft.topics.filter(tag=>tag!==key)})}),label))),
          draft.mode==='phone'?field('phone','Phone number','tel',{maxLength:100}):field('joinUrl','Meeting link','url',{maxLength:4000}),
          past&&field('transcript','Meeting transcript','textarea',{rows:8}),
          h('p',{className:'meeting-help'},`Timezone: ${editZone}.`)):
          h(React.Fragment,null,
            h('div',{className:'meeting-history-tabs','aria-label':'Record views'},...tabs.map(([key,label])=>h('button',{key,type:'button','aria-pressed':tab===key,onClick:()=>setTab(key)},label))),
            tab==='chat'?h(Conversation,{conversation,timeZone}):tab==='previous'?h(PreviousMeetings,{records:history,timeZone}):h(React.Fragment,null,
              outcome?h('div',{className:'meeting-summary'},h(Tags,{record,now}),h('p',null,'Application record'),h('time',{dateTime:recordUpdatedAt(record)||undefined,'aria-label':'Last updated'},'Last updated: ',recordUpdatedAt(record)?`${meetingDate(recordUpdatedAt(record),timeZone).date} · ${meetingDate(recordUpdatedAt(record),timeZone).time}`:'Not recorded'),meetingLink(record.jobLink)&&h('a',{className:'meeting-url',href:meetingLink(record.jobLink),target:'_blank',rel:'noopener noreferrer'},'View job posting')):
                h('div',{className:'meeting-summary'},h('time',{dateTime:meeting.startsAt||undefined},date.date,date.time&&` · ${date.time}`),h(Tags,{record,now}),h('p',null,h('strong',null,'Interviewer: '),meeting.interviewer||'Not specified')),
              !outcome&&(tab==='transcript'?h('section',{className:'meeting-history','aria-label':'Meeting transcript'},h('p',null,meeting.transcript||'No transcript saved yet.')):
                !past&&(meeting.mode==='phone'?h('section',{className:'meeting-phone'},h('h3',null,'Phone number'),h('p',{className:'meeting-phone-number'},meeting.phone||'No phone number saved.'),meeting.phone&&!record.isMock&&h('a',{className:'web-button',href:`tel:${meeting.phone.replace(/[^+\d]/g,'')}`},'Call interviewer')):
                  h('section',{className:'meeting-video'},h('h3',null,'Meeting link'),link?h(React.Fragment,null,h('a',{href:link,target:'_blank',rel:'noopener noreferrer',className:'meeting-url'},link),h('a',{href:link,target:'_blank',rel:'noopener noreferrer',className:'web-button'},record.isMock?'Open demo meeting':'Join video meeting')):h('p',null,'Add a date and meeting link to schedule this meeting.'))))))),
      h('footer',{className:'meeting-dialog-footer'},editing?h(React.Fragment,null,h('button',{type:'button',className:'web-button',disabled:saving,onClick:()=>setEditing(false)},'Cancel'),h('button',{type:'submit',form:'meeting-edit-form',className:'web-button primary',disabled:saving},saving?'Saving…':'Save meeting')):h('button',{type:'button',className:'web-button',onClick:outcome?onClose:edit},outcome?'Close':'Edit meeting')));
  }
  return {MeetingCard,MeetingDialog};
}
