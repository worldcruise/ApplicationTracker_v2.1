import assert from 'node:assert/strict';
import test from 'node:test';
import {dockFixture,memoryStorage} from './helpers/dock-records-fixture.mjs';
import {createMeetingSamples,loadMeetingSamples} from './fixtures/meeting-samples.mjs';
import {loadApplicationSamples} from './fixtures/application-samples.mjs';
import {clearLocalMockData,isMockRecord} from './fixtures/sample-data.mjs';

test('clearing local demo data preserves real applications, meetings, documents, profile and settings',async()=>{
  const real={id:'real-app',companyName:'Cedar Health',jobLink:'https://real-company.test/job',status:'interview'},meeting={id:'real-meeting',applicationId:'real-app',status:'interview'},profile={name:'My profile',resume:'My resume'};
  const local=memoryStorage({appliedList:[real,{id:'mock-application:cedar',isMock:true},{id:'csv-demo',jobLink:'https://example.test/mock-meetings/cedar'}],
    'meeting-mock-cards:v1':[...createMeetingSamples(),meeting],
    'meeting-application-overrides:v1':{'mock-application:cedar':{status:'offer'},'real-app':{notes:'Keep'}},
    'meeting-application-documents:v1':{'mock-application:cedar':{resume:'Demo'},'real-app':{resume:'Real'}},
    'meeting-details:v1':{'mock-meeting:cedar':{transcript:'Demo'},'real-meeting':{transcript:'Real transcript'}},
    'meeting-workflow-receipts:v1':{mockReceipt:'demo'},profile,dailyGoal:20,'meeting-timezone:v1':'America/New_York'});
  const browser={storage:{local}};await clearLocalMockData(browser);
  assert.deepEqual(local.values.appliedList,[real]);assert.deepEqual(local.values['meeting-mock-cards:v1'],[meeting]);
  assert.deepEqual(local.values['meeting-application-overrides:v1'],{'real-app':{notes:'Keep'}});assert.deepEqual(local.values['meeting-application-documents:v1'],{'real-app':{resume:'Real'}});
  assert.deepEqual(local.values['meeting-details:v1'],{'real-meeting':{transcript:'Real transcript'}});assert.deepEqual(local.values['meeting-workflow-receipts:v1'],{});
  assert.deepEqual(local.values.profile,profile);assert.equal(local.values.dailyGoal,20);assert.equal(local.values['meeting-timezone:v1'],'America/New_York');
  const before=structuredClone(local.values);await clearLocalMockData(browser);assert.deepEqual(local.values,before);
  assert.deepEqual(await loadMeetingSamples(browser),[meeting]);assert.deepEqual(await loadApplicationSamples(browser),[]);
});
