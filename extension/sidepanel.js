import {mountDockDashboard} from './studio/dock-dashboard-view.js';
import {createNativePanelClient} from './studio/native-panel-client.js';
import {mountNativePanelHeader} from './studio/native-panel-header.js';

const host=document.getElementById('native-panel-root');
async function start(){
  const client=await createNativePanelClient(),pending=await client.takeView(),dock=mountDockDashboard(host,{browser:client.browser,initialView:pending.view||undefined});
  const header=mountNativePanelHeader(dock.root,{browser:client.browser});
  async function showPending(){const {view}=await client.takeView();if(view==='apply')await dock.showApply();}
  const show=(message,sender)=>{if(sender.id===chrome.runtime.id&&message?.type==='native-panel:show'&&message.windowId===client.context.windowId)void showPending().catch(report);};
  chrome.runtime.onMessage.addListener(show);
  window.addEventListener('pagehide',()=>{chrome.runtime.onMessage.removeListener(show);header.close();dock.close();},{once:true});
  await dock.ready;document.documentElement.dataset.panelReady='true';
}
function report(error){let node=host.querySelector('[data-panel-error]');if(!node){node=document.createElement('p');node.dataset.panelError='';node.setAttribute('role','alert');host.prepend(node);}node.textContent=error.message;}
void start().catch(report);
