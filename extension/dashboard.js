import {mountDockDashboard} from './studio/dock-dashboard-view.js';
const dock=mountDockDashboard(document.getElementById('reference-dashboard-root'));
const initial=new URLSearchParams(window.location.hash.slice(1));
if(initial.has('cv'))void dock.editResume(initial.get('cv'),{letter:initial.get('letter')==='1'}).catch(error=>console.error('CV input could not open:',error));
window.addEventListener('pagehide',()=>dock.close(),{once:true});
