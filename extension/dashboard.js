import {mountDockDashboard} from './studio/dock-dashboard-view.js';
const dock=mountDockDashboard(document.getElementById('reference-dashboard-root'));
window.addEventListener('pagehide',()=>dock.close(),{once:true});
