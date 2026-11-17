import {React,createRoot} from '../extension/vendor/react.js';
import {createWebHeader} from '../extension/studio/web-header.js';
import {createWebDashboard} from '../extension/studio/web-dashboard.js';
import {createWebApplications} from '../extension/studio/web-applications.js';
import {createApplicationsPage,createMeetingBoard} from '../extension/studio/applications-page.js';
import {createMeetingsBoardPage} from '../extension/studio/meetings-board-page.js';
import {createProfileResumePage} from '../extension/studio/profile-resume-page.js';
import {createPromptSettings,createOtherSettings,createCandidatePromptSettings,createAISettings,createKeywordSettings,createKeyboardSettings,createSettingsNavigation} from '../extension/studio/prompt-settings.js';
import {createAutofillSettings} from '../extension/studio/autofill-settings.js';
import {StudioPreviewLink,ResumeStudioPage} from '../extension/studio/preview-components.js';
import '../extension/ai-apply/src/keyword-matcher.js';
import '../extension/ai-apply/src/workspace-shortcut-keys.js';

const Header=createWebHeader(React),Dashboard=createWebDashboard(React),Profile=createProfileResumePage(React);
const Prompts=createPromptSettings(React),Other=createOtherSettings(React),Candidate=createCandidatePromptSettings(React);
const AI=createAISettings(React),Keywords=createKeywordSettings(React),Keyboard=createKeyboardSettings(React),Autofill=createAutofillSettings(React);
function Link({to,children,...props}){return <a {...props} href={'#'+to}>{children}</a>;}
const SettingsNavigation=createSettingsNavigation(React,Link),MeetingBoard=createMeetingBoard(React);
const Meetings=createMeetingsBoardPage(React,{Board:MeetingBoard});
const Applications=createWebApplications(React,{Applications:createApplicationsPage(React),Board:()=> <Meetings boardOnly />});
const aliases={'/settings':'/settings/profile','/profile':'/settings/profile','/profile/new':'/settings/profile','/settings/profile/new':'/settings/profile','/settings/prompts':'/settings/ai/prompt','/settings/ai':'/settings/ai/resume-generation','/settings/autofill':'/settings/ai/autofill'};
function App(){
  const [hash,setHash]=React.useState(location.hash||'#/dashboard');
  React.useEffect(()=>{const change=()=>setHash(location.hash||'#/dashboard');window.addEventListener('hashchange',change);window.addEventListener('popstate',change);return()=>{window.removeEventListener('hashchange',change);window.removeEventListener('popstate',change);};},[]);
  const path=(hash.replace(/^#/,'').split('?')[0]||'/'),route=aliases[path]||path;
  React.useEffect(()=>{if(aliases[path])location.replace('#'+route);},[path,route]);
  const settings={
    '/settings/profile':Profile,'/settings/ai/resume-generation':AI,'/settings/ai/autofill':Autofill,
    '/settings/ai/candidate':Candidate,'/settings/ai/prompt':Prompts,'/settings/keywords':Keywords,'/settings/keyboard':Keyboard,'/settings/other':Other
  };
  const Page=settings[route];
  const content=Page?<><div className="settings-page-heading"><h1>Settings</h1></div><div className="web-settings-layout"><aside className="web-settings-sidebar"><SettingsNavigation pathname={route}/></aside><div className="web-settings-content"><Page/></div></div></>:
    route==='/dashboard'?<Dashboard/>:route==='/meetings'?<Meetings/>:route==='/'?<Applications/>:route==='/resume-studio'?<ResumeStudioPage/>:<section><h1>Page not found</h1><Link to="/dashboard">Back to dashboard</Link></section>;
  return <div className="web-app-shell"><div className="web-app-scroll"><Header active={route} Link={Link} StudioLink={StudioPreviewLink}/><main className="web-app-main">{content}</main></div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
