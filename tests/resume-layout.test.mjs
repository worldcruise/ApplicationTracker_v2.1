import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { layoutResumeParagraph, resumeSectionOrder, SKILLS_FIRST_TEMPLATES } from '../extension/studio/resume-layout.js';
import { monthInputValue } from '../extension/studio/month-input.js';
import { resumeRenderer } from './helpers/resume-renderer.mjs';

test('justified hanging bullets align continuation text and preserve natural final lines',()=>{
  const lines=layoutResumeParagraph({text:'First line wraps to the next line.',x:10,width:100,bullet:true,measure:text=>text.length*5,wrap:()=>['First line wraps','to the next line.']});
  assert.equal(lines[0].text,'•');assert.equal(lines[0].x,10);
  assert.equal(lines[1].x,20);assert.equal(lines[2].x,20);assert.equal(lines[1].lineIndex,0);assert.equal(lines[2].lineIndex,1);
  const last=lines[1].words.at(-1);assert.equal(last.x+last.text.length*5,110);
  assert.equal(lines[2].words,undefined);
});

test('all five real template layouts place Technical Skills directly after Summary and retain hanging bullets',async()=>{
  const renderer=await resumeRenderer();
  for(const id of SKILLS_FIRST_TEMPLATES){
    const snapshot=renderer.fixture(id);snapshot.formattingOverrides.educationBeforeSkills=true;
    const result=renderer.trace(snapshot);
    assert.deepEqual(resumeSectionOrder(id,snapshot.formattingOverrides),['summary','skills','experience','education']);
    const headings=result.text.filter(run=>['Summary','Technical Skills','Experience','Education'].includes(run.text)).map(run=>run.text);
    assert.deepEqual(headings,['Summary','Technical Skills','Experience','Education'],`${id}: Skills follows Summary`);
    snapshot.formattingOverrides.showSummary=false;
    const withoutSummary=renderer.trace(snapshot);
    assert.ok(!withoutSummary.content.includes('Summary'));
    assert.ok(withoutSummary.content.indexOf('Technical Skills')<withoutSummary.content.indexOf('Experience'),`${id}: Skills stays first when Summary is hidden`);
    const marker=result.text.findIndex(run=>run.text==='•'),first=result.text[marker+1],continued=result.text.find(run=>run.text.startsWith('Continuation'));
    assert.ok(marker>=0);assert.ok(first.x>result.text[marker].x);assert.equal(continued.x,first.x,`${id}: wrapped bullet starts at its text indent`);
    assert.ok(result.text.filter(run=>run.text==='•').length===2);
  }
  assert.deepEqual(resumeSectionOrder('azurill'),['summary','experience','skills','education']);
  assert.deepEqual(resumeSectionOrder('glalie',{educationBeforeSkills:true}),['summary','experience','education','skills']);
});

test('month values retain stored precision until an explicit edit',()=>{
 const original={issuedOn:'2024-06-15',expiresOn:'2027-06-30'};assert.equal(monthInputValue(original.issuedOn),'2024-06');assert.equal(monthInputValue(original.expiresOn),'2027-06');assert.deepEqual(original,{issuedOn:'2024-06-15',expiresOn:'2027-06-30'});assert.equal(monthInputValue('2025-02'),'2025-02');assert.equal(monthInputValue('unknown'),'unknown');
});

test('a long bullet retains its hanging indent across page breaks',async()=>{
  const renderer=await resumeRenderer(),snapshot=renderer.fixture('moderncv-gutter');
  snapshot.resume.experience[0].sentences=['Delivered ' + 'reliable systems with clear documentation and careful testing '.repeat(90)];
  const result=renderer.trace(snapshot),marker=result.text.findIndex(run=>run.text==='•'),textX=result.text[marker+1].x;
  assert.ok(result.pages>1);assert.equal(result.text.filter(run=>run.text==='•').length,1);
  assert.equal(result.text.find(run=>run.text==='Experience').page,result.text[marker].page,'The heading stays with its role and the first bullet line');
  const nextPage=result.text.filter(run=>run.page===1&&run.size===snapshot.formattingOverrides.bodyFontSize);
  assert.ok(nextPage.length>0);assert.equal(nextPage[0].x,textX);
  assert.ok(nextPage.every(run=>run.y>=snapshot.formattingOverrides.pageMargin));
});
