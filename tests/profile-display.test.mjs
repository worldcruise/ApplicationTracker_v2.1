import assert from 'node:assert/strict';
import test from 'node:test';
import {createProfileNameLookup} from '../extension/studio/profile-display.js';
import {emptyProfile} from '../extension/studio/profile-model.js';

test('candidate names resolve complete profile names without renaming stored aliases',()=>{
  const profile={...emptyProfile(),profileName:'Default',nameData:{firstName:'Jordan',middleName:'Patrick',lastName:'Taylor',preferredName:false}};
  const display=createProfileNameLookup([{id:'one',profile}]);
  for(const record of [profile,{id:'one'},{candidateId:'one',candidateName:'Default'},{profileName:'Default'},'Default'])assert.equal(display(record),'Jordan Patrick Taylor');
  assert.equal(profile.profileName,'Default');
  const ambiguous=createProfileNameLookup([{id:'one',name:'Jordan Patrick Taylor',profileName:'Default'},{id:'two',name:'Jamie Chen',profileName:'Default'}]);
  assert.equal(ambiguous({candidateId:'two',profileName:'Default'}),'Jamie Chen');
  assert.equal(ambiguous({candidateName:'Historical Candidate',profileName:'Default'}),'Historical Candidate');
});
