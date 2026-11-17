import {createUseWorkspaceSummary} from './workspace-summary.js';
import {createMeetingComponents} from './meeting-card.js';
import {meetingNeedsAction,meetingRange,previousMeetingHistory,applicationConversation} from './meeting-model.js';
import {applicationDocumentRecord} from './record-presentation.js';
import {createWebSidebarHook} from './web-sidebar.js';
export const WEB_PAGES = [
  { name: 'Dashboard', path: '/dashboard', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { name: 'Resume Studio', path: '/resume-studio', icon: 'M14 3H5v18h14v-8M14 3v6h6M9 16l9-9 3 3-9 9-4 1z' },
  { name: 'Applications', path: '/', icon: 'M8 6V3h8v3M3 6h18v15H3zM3 11h18M10 11v3h4v-3' },
  { name: 'Meetings', path: '/meetings', icon: 'M4 5h16v16H4zM8 2v6m8-6v6M4 11h16M8 15h3m2 0h3' },
  { name: 'Settings', path: '/settings', startsWith: true, icon: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6' },
];

export function createWebHeader(React) {
  const h = React.createElement;
  const useTheme = createThemeHook(React),useSummary=createUseWorkspaceSummary(React);
  const useSidebar=createWebSidebarHook(React);
  const {MeetingDialog}=createMeetingComponents(React);
  function AlarmDropdown({summary,error}){
    const [open,setOpen]=React.useState(false),[selected,setSelected]=React.useState(null),host=React.useRef(null),trigger=React.useRef(null);
    const count=summary?.alerts.total||0,zone=summary?.meetings.timeZone,records=summary?.meetings.sourceRecords||[];
    React.useEffect(()=>{
      if(!open)return;
      const outside=event=>{if(!host.current?.contains(event.target))setOpen(false);};
      const escape=event=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
      document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
      return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
    },[open]);
    return h('div',{className:'workspace-alarm-container',ref:host},
      h('button',{type:'button',ref:trigger,className:'workspace-icon-button workspace-alarm',title:'Meetings and reminders','aria-label':`Meetings and reminders, ${count} alerts`,'aria-expanded':open,'aria-controls':'workspace-reminders',onClick:()=>setOpen(value=>!value)},
        h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('path',{d:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6'})),
        h('span',{className:'workspace-alarm-badge','data-active':count>0,'aria-hidden':true},summary?String(count):'…')),
      open&&h('section',{id:'workspace-reminders',className:'workspace-reminders','aria-label':'Meetings and reminders'},
        h('header',null,h('strong',null,'Meetings and reminders'),h('span',null,String(count))),
        error?h('p',{role:'alert'},error):!summary?h('p',null,'Loading reminders…'):!count?h('p',null,'You’re all caught up. No reminders right now.'):
          h('ul',null,...summary.alerts.items.map(record=>{const needs=meetingNeedsAction(record.meeting),date=meetingRange(record.meeting,zone,true);return h('li',{key:record.id},h('button',{type:'button',className:'workspace-reminder-item',onClick:()=>{setOpen(false);setSelected(record);}},h('strong',null,record.companyName),h('span',null,record.jobTitle),h('small',{'data-needs-action':needs},needs?'Needs action':"Today · "+date.time),h('time',{dateTime:record.meeting.startsAt},date.date+' · '+date.time)));}))),
      selected&&h(MeetingDialog,{record:selected,onClose:()=>{setSelected(null);trigger.current?.focus();},timeZone:zone,now:Date.now(),readOnly:true,initialTab:'details',history:previousMeetingHistory(selected,records),conversation:applicationConversation(selected,records),documentRecord:applicationDocumentRecord(selected,summary?.applications)}));
  }
  function ThemeButton() {
    const theme = useTheme();
    return h('div', { className: 'web-theme-control' },
      h('button', { type: 'button', className: 'web-theme-toggle', onClick: theme.toggle,
        title: `Switch to ${theme.theme === 'dark' ? 'light' : 'dark'} theme`,
        'aria-label': `Switch to ${theme.theme === 'dark' ? 'light' : 'dark'} theme`, 'aria-pressed': theme.theme === 'dark' },
        h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', 'aria-hidden': true },
          h('path', { d: theme.theme === 'dark' ? 'M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z' : 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0' }))),
      theme.error && h('button', { type: 'button', className: 'web-theme-error', role: 'alert', onClick: theme.retry }, `${theme.error} Retry`));
  }
  return function WebHeader({ active, items = WEB_PAGES, Link, StudioLink }) {
    const [navigationError, setNavigationError] = React.useState('');
    const sidebar=useSidebar();
    const {state:summary,error:summaryError}=useSummary();
    const displayName=summary?.candidate?.name||'',pageName=items.find(item=>item.path===active)?.name||(active.startsWith('/settings')?'Settings':'Workspace');
    const alarmCount=summary?.alerts.total||0;
    const base = globalThis.chrome?.runtime?.getURL('options.html') || 'options.html';
    const link = (path, props, children, Studio = false) => h(Studio && StudioLink || Link || 'a', {
      ...props, ...(Link || Studio && StudioLink ? { to: path } : { href: `${base}#${path}` }),
      ...(!Link && !(Studio && StudioLink) ? { onClick: event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); setNavigationError('');
        openDashboard(path).catch(error => setNavigationError(error.message));
      } } : {}),
    }, children);
    return h('header', { className: 'autofill-web-header' },
      h('div', { className: 'autofill-web-header-inner' },
        link('/dashboard', { className: 'autofill-web-brand', 'aria-label': `${APP_NAME} dashboard` }, [
          h('img', { key: 'icon', src: appIconUrl(), alt: '', width: 32, height: 32 }),
          h('span', { key: 'name', className: 'application-tracker-wordmark' }, APP_NAME),
        ]),
        h('nav', { id:'workspace-navigation',className: 'autofill-web-nav', 'aria-label': 'Extension pages' }, items.map(item => {
          const selected = item.startsWith ? active.startsWith(item.path) : active === item.path;
          const props = { key: item.path, className: 'autofill-web-link',title:item.name,'aria-label':item.name, 'aria-current': selected ? 'page' : undefined };
          const content = [h('svg', { key: 'icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: item.icon })), h('span', { key: 'label' }, item.name)];
          if(item.name==='Applications'||item.name==='Meetings')content.push(h('span',{key:'count',className:'workspace-count',title:summaryError||(item.name==='Applications'?'Jobs in queue':'Needs action and today’s upcoming meetings')},summary?(item.name==='Applications'?summary.queue.total:summary.alerts.total):'…'));
          if (selected && item.path === '/resume-studio' && !StudioLink) return h('a', { ...props, href: '#', onClick: event => event.preventDefault() }, content);
          return link(item.path, props, content, item.path === '/resume-studio');
        })),
        h('div', { className: 'web-header-actions', 'aria-label': 'Profile' },
          active!=='/resume-studio'&&link('/settings/profile',{className:'workspace-profile','aria-label':displayName?displayName+' profile':'Profile settings',title:displayName||'Profile settings'},[h('span',{key:'avatar',className:'workspace-profile-avatar','aria-hidden':true},summary?.candidate?.name?.charAt(0)||'P'),h('span',{key:'name'},summary?.candidate?.name||'My profile')]),
        ),
      ),
      h('div',{className:'workspace-topbar'},h('div',{className:'workspace-topbar-start'},h('button',{type:'button',className:'workspace-icon-button workspace-sidebar-toggle',title:sidebar.collapsed?'Expand sidebar':'Collapse sidebar','aria-label':sidebar.collapsed?'Expand sidebar':'Collapse sidebar','aria-expanded':!sidebar.collapsed,'aria-controls':'workspace-navigation',onClick:sidebar.toggle},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('rect',{x:3,y:4,width:6,height:16,rx:1,fill:'currentColor',fillOpacity:.12,stroke:'none'}),h('rect',{x:3,y:4,width:18,height:16,rx:2.5}),h('path',{d:'M9 4v16'}),h('path',{d:sidebar.collapsed?'m14 9 3 3-3 3':'m17 9-3 3 3 3'}))),h('nav',{'aria-label':'Breadcrumb',className:'workspace-breadcrumb'},link('/dashboard',{},'Workspace'),h('span',{'aria-hidden':true},'/'),h('span',{'aria-current':'page'},pageName),active.startsWith('/settings/')&&h('span',null,' / '+(active.startsWith('/settings/ai/')?'AI settings / ':'')+({'resume-generation':'Resume Generation',prompt:'Prompt',candidate:'Candidate Form',keywords:'Keyword highlights',keyboard:'Keyboard shortcuts'}[active.split('/').at(-1)]||active.split('/').at(-1).replace(/^./,letter=>letter.toUpperCase()))))),
        h('div',{className:'workspace-topbar-actions'},h(ThemeButton),h(AlarmDropdown,{summary,error:summaryError}),link('/settings/profile',{className:'workspace-profile-avatar',title:displayName||'Profile settings','aria-label':displayName?displayName+' profile':'Profile settings'},displayName?.charAt(0)||h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('path',{d:'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'}))))),
      navigationError && h('p', { className: 'web-message web-error', role: 'alert' }, navigationError),
    );
  };
}
import { APP_NAME, appIconUrl } from './branding.js';
import { createThemeHook } from './theme.js';
import { openDashboard } from './dock.js';

