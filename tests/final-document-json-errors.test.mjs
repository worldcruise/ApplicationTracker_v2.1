import test from 'node:test';
import assert from 'node:assert/strict';
import {combinedDocumentObject} from '../extension/ai-apply/src/generation-data.mjs';
import {validateFinalDocumentShape,DOCUMENT_CONTRACT_VERSION} from '../extension/ai-apply/src/document-contract.mjs';

const document={job:{company:'Cotiviti',title:'Technical Writer',applyUrl:'https://careers-cotiviti.icims.com/jobs/23029/technical-writer/job',description:'Technical Writer\n\nBase compensation ranges from $72,000 to $108,000 per year.',salary:{min:72000,max:108000,currency:'USD',period:'year',sourceText:'Base compensation ranges from $72,000 to $108,000 per year.'}},resume:{company:'Cotiviti',title:'Technical Writer',summary:'Technical documentation professional.',skills:[{'Technical Documentation':['Technical Writing','Standard Operating Procedures']}],experience:[{title:'Senior Technical Writer',company:'Example Employer',sentences:['Maintained engineering documentation.']}],education:[{degree:'Bachelor of Science in Electrical Engineering'}]},coverLetter:'I write clear technical documentation.\n\nI work with engineering teams.'};

test('the reported salary and final document shape parse correctly when closed exactly once',()=>{
  const value=combinedDocumentObject(JSON.stringify(document,null,2));
  assert.deepEqual(value,document);
  assert.doesNotThrow(()=>validateFinalDocumentShape(value,{version:DOCUMENT_CONTRACT_VERSION,selectedModules:['job','resume','coverLetter']}));
});

test('an extra closing brace is reported with its exact line instead of silently removed',()=>{
  const json=JSON.stringify(document,null,2),raw=json+'\n}';
  assert.throws(()=>combinedDocumentObject(raw),error=>error.code==='invalid-document-json'&&/Extra closing brace/.test(error.message)&&error.line===json.split('\n').length+1&&error.column===1);
  assert.throws(()=>combinedDocumentObject('```json\n'+raw+'\n```'),/Extra closing brace/);
});

test('duplicate objects and trailing text are distinguished from incomplete JSON',()=>{
  const json=JSON.stringify(document);
  assert.throws(()=>combinedDocumentObject(json+'\n'+json),/More than one JSON object/);
  assert.throws(()=>combinedDocumentObject(json+'\nExplanation'),/Unexpected text after/);
  assert.throws(()=>combinedDocumentObject('{"resume":'),/JSON is incomplete/);
  assert.throws(()=>combinedDocumentObject('{"coverLetter":"First line\nSecond line"}'),/Invalid JSON string/);
});

test('escaped newlines, quotes and braces inside text remain unchanged',()=>{
  const value={coverLetter:'A "quoted" answer with } and { inside it.\nNext paragraph.'};
  assert.deepEqual(combinedDocumentObject('```json\n'+JSON.stringify(value)+'\n```'),value);
});
