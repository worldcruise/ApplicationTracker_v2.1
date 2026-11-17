import {createElement} from './react-host';

export const settingsSections = [
  {label:'Profile',path:'/settings/profile',icon:'profile'},
  {label:'AI settings',path:'/settings/ai/resume-generation',icon:'sparkles',children:[
    {label:'Resume Generation',path:'/settings/ai/resume-generation'},
    {label:'Autofill',path:'/settings/ai/autofill'},
    {label:'Candidate Form',path:'/settings/ai/candidate'},
    {label:'Prompt',path:'/settings/ai/prompt'}
  ]},
  {label:'Keyword highlights',path:'/settings/keywords',icon:'highlight'},
  {label:'Keyboard shortcuts',path:'/settings/keyboard',icon:'keyboard'},
  {label:'Other',path:'/settings/other',icon:'settings'}
];

const paths={
  profile:'M20 21v-2a7 7 0 0 0-14 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  sparkles:'m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z',
  highlight:'m9 11 7-7 5 5-7 7 M9 11l5 5-4 3-5-5Z M3 21h12',
  keyboard:'M3 5h18v14H3Z M6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M7 16h10',
  settings:'M4 7h16M4 17h16 M8 4v6m8 4v6'
};
function Icon({name}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;}

export function settingsNavigation(Link){
  return function SettingsNavigation({pathname}){
    return <nav className="settings-sections" aria-label="Settings sections">{settingsSections.map(section=>{
      const active=section.children?pathname.startsWith('/settings/ai'):pathname===section.path||section.path==='/settings/profile'&&pathname.startsWith('/settings/profile/');
      return <div className="settings-section" key={section.path}>{createElement(Link,{to:section.path,className:'settings-section-link'+(active?' is-active':''),'aria-current':active&&!section.children?'page':undefined},<Icon name={section.icon} />,<span>{section.label}</span>)}{section.children&&<div className="settings-subsections" aria-label="AI settings">{section.children.map(item=>createElement(Link,{key:item.path,to:item.path,className:'settings-subsection-link'+(pathname===item.path?' is-active':''),'aria-current':pathname===item.path?'page':undefined},item.label))}</div>}</div>;
    })}</nav>;
  };
}
