import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativePanelVisibility} from '../extension/studio/native-panel-visibility.js';
import {event} from './helpers/dock-records-fixture.mjs';

function fixture(modern=true){
 const tabs=new Map([[1,{id:1,windowId:41,active:true,url:'chrome-extension://test/options.html#/settings/profile'}],[2,{id:2,windowId:42,active:true,url:'https://employer.test/apply'}]]),closed=[],options=[];
 const browser={runtime:{getURL:path=>'chrome-extension://test/'+path},sidePanel:{setOptions:async value=>options.push(value),...(modern?{close:async value=>closed.push(value)}:{})},tabs:{get:async id=>tabs.get(id),query:async()=>[...tabs.values()],onUpdated:event(),onActivated:event(),onRemoved:event()}};
 return {browser,tabs,closed,options,service:createNativePanelVisibility(browser)};
}
test('extension pages close only the dock in their active window; employer pages and background pages leave it alone',async()=>{
 const app=fixture();await app.service.initialize();assert.deepEqual(app.closed,[{windowId:41}]);await app.service.sync(app.tabs.get(2));assert.equal(app.closed.length,1);
 app.tabs.get(1).active=false;await app.service.sync(app.tabs.get(1));assert.equal(app.closed.length,1);app.tabs.get(1).url='chrome-extension://other/options.html';app.tabs.get(1).active=true;await app.service.sync(app.tabs.get(1));assert.equal(app.closed.length,1);
});
test('older Chrome hides the dock only for extension tabs and restores availability when that tab navigates to an employer',async()=>{
 const app=fixture(false);await app.service.initialize();assert.deepEqual(app.options,[{tabId:1,enabled:false}]);app.tabs.get(1).url='https://employer.test/apply';await app.service.sync(app.tabs.get(1));assert.deepEqual(app.options.at(-1),{tabId:1,enabled:true});assert.equal(app.options.some(value=>value.tabId===2),false);
});
test('queued tab updates use current state and do not close a window after the user has switched away',async()=>{
 const app=fixture(),stale={...app.tabs.get(1)};app.tabs.get(1).active=false;await app.service.sync(stale);assert.equal(app.closed.length,0);
});
