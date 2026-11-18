import {createUseWorkspaceSummary} from './workspace-summary.js';
import {createApplicationRecordUI} from './application-record-ui.js';
import {createApplicationFilters} from './application-filters.js';
import {matchesApplicationDate} from './application-filter-model.js';
import {createApplicationsManage} from './applications-manage.js';
import {projectMeetingRecords} from './meeting-model.js';

const raw=record=>({...record,companyName:record.companyName||record.company,jobTitle:record.jobTitle||record.role,jobLink:record.jobLink||record.url,appliedAt:record.createdAt||record.date,date:record.createdAt||record.date});
const STAGES=[['applied','Applied'],['screen','Screening'],['interview','Interview'],['rejected','Rejected'],['archived','Failed'],['offer','Offer']];
function matches(row,filters,meeting=false){
  const terms=filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean),text=`${row.companyName} ${row.jobTitle}`.toLowerCase();return terms.every(term=>text.includes(term))&&
    (filters.status==='all'||row.status===filters.status)&&matchesApplicationDate(meeting?row.meeting?.startsAt||row.appliedAt:row.date,filters,Date.now(),meeting?row.meeting?.endsAt:row.date);
}
export function createApplicationsPage(React){
  const h=React.createElement,useSummary=createUseWorkspaceSummary(React),UI=createApplicationRecordUI(React),Context=React.createContext(null);
  const Manage=createApplicationsManage(React);
  const Filters=createApplicationFilters(React,{useApplications:()=>React.useContext(Context),Manage});
  return function ApplicationsPage({view='list'}){
    const {state,error}=useSummary(),[filters,setFilters]=React.useState({query:'',status:'all',period:'all',view});
    const records=(state?.applications||[]).map(raw).filter(row=>matches(row,filters));
    async function remove(id){if(!globalThis.confirm('Delete this application?'))return;const record=state.applications.find(row=>row.id===id),reply=await chrome.runtime.sendMessage({version:1,requestId:crypto.randomUUID(),operation:'DOCK_RECORDS_MUTATE',payload:{action:'delete',type:'applications',id,expectedRevision:record.revision,mutationId:crypto.randomUUID()}});if(!reply?.ok)throw Error(reply?.error?.message||'The application could not be deleted.');}
    const columns=UI.columns({onDelete:remove},state?.applications||[],view);
    return h(Context.Provider,{value:{filters,onFiltersChange:setFilters}},h('section',{className:'applications-page','data-record-layout':view},h(Filters),
      error&&h('p',{role:'alert'},error),!state?h('p',{role:'status'},'Loading applications…'):records.length?view==='cards'?h('div',{className:'application-card-grid'},...records.map(record=>h('article',{key:record.id,className:'application-card'},h(UI.Main,{record}),h(UI.Status,{record}),h('time',{dateTime:record.date},new Date(record.date).toLocaleDateString()),h(UI.Actions,{record,onDelete:remove})))):
      h('div',{className:'application-table-scroll'},h('table',{'data-test':'applications-table',className:'applications-table'},h('thead',null,h('tr',null,...columns.map(column=>h('th',{key:column.id,scope:'col',className:column.className},column.header)))),h('tbody',null,...records.map(record=>h('tr',{key:record.id},...columns.map(column=>h('td',{key:column.id,className:column.className},column.cell(record)))))))):h('p',{className:'web-empty'},'No applications match these filters.')));
  };
}

export function createMeetingBoard(React){
  const h=React.createElement,useSummary=createUseWorkspaceSummary(React),Context=React.createContext(null),UI=createApplicationRecordUI(React);
  const Manage=createApplicationsManage(React);
  const Filters=createApplicationFilters(React,{useApplications:()=>React.useContext(Context),Manage:()=>React.useContext(Context).manageApplications?h(Manage):null});
  return function MeetingBoard({view='board',boardOnly=false,meetingDetails={},meetingSort,meetingTimezone,columnGroups,renderMeetingView,renderMeetingCard,filterTrailingControl}){
    const {state,error}=useSummary(),[filters,setFilters]=React.useState({query:'',status:'all',period:'all',view});
    const sources=state?.meetings.sourceRecords||[],allRecords=projectMeetingRecords(sources,meetingDetails).map(raw),records=allRecords.filter(row=>(boardOnly||row.status!=='applied')&&matches(row,{...filters,timezone:meetingTimezone},true)).sort(meetingSort);
    if(boardOnly)columnGroups=[{id:'active',statuses:['applied','screen','interview']},{id:'closed',statuses:['rejected','archived']},{id:'offers',statuses:['offer']}];
    const app={filters,onFiltersChange:setFilters,allowedStatuses:STAGES.map(([value])=>value),statusLabels:{archived:'Failed'},manageApplications:boardOnly};
    return h(Context.Provider,{value:app},h(React.Fragment,null,h(Filters,{trailingControl:filterTrailingControl}),error&&h('p',{role:'alert'},error),
      view!=='board'?renderMeetingView({records,allRecords,sourceRecords:sources,filters}):h('div',{'data-test':'applications-board','data-board-only':String(boardOnly)},...(columnGroups||[{id:'all',statuses:STAGES.map(([id])=>id)}]).map(group=>h('section',{key:group.id,className:'meeting-column-group','data-group':group.id},h('div',{className:'meeting-group-columns'},...STAGES.filter(([id])=>group.statuses.includes(id)).map(([status,label])=>h('section',{key:status,'data-test':`applications-board-column-${status}`},h('div',null,h('h2',null,label),h('span',null,records.filter(row=>row.status===status).length)),h('div',null,...records.filter(row=>row.status===status).map(row=>h('div',{key:row.id,'data-test':'applications-board-card'},row.status==='applied'?h('article',{className:'application-card'},h(UI.Main,{record:row}),h(UI.Status,{record:row})):renderMeetingCard(row,allRecords))))))))))));
  };
}
