import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { resumeSectionOrder, skillsFirstTemplate, layoutResumeParagraph } from '../../extension/studio/resume-layout.js';

export async function resumeRenderer() {
  const renderer = vm.createContext({ resumeSectionOrder, skillsFirstTemplate, layoutResumeParagraph,
    chrome:{runtime:{id:'layout-test',getURL:path=>`chrome-extension://layout-test/${path}`,onMessage:{addListener(){}}}},
    crypto:webcrypto,indexedDB:new IDBFactory(),Blob,DOMException,TextEncoder,TextDecoder,URL,console,atob,btoa,structuredClone,
    setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,document:{getElementById:()=>null} });
  const source=(await readFile('extension/offscreen.js','utf8')).replace(/^import[^\n]+\n/gm,'');vm.runInContext(source,renderer);
  function fixture(id) {
    const template=structuredClone(renderer.Ew.find(template=>template.id===id));
    return {schemaVersion:2,resumeContractVersion:1,workspaceId:'41',draftId:`layout-${id}`,documentRevision:1,candidateRevision:1,
      candidate:{id:'layout-candidate',name:'Jordan Taylor'},documentTemplate:template,formattingOverrides:{...template.settings,includeCertifications:true},
      profile:{contact:['jordan@example.test','Boston, MA'],links:['https://example.test'],
        experience:[{id:'role-1',label:'Northstar Systems',company:'Northstar Systems',role:'Senior Software Engineer',startDate:'2020-03',endDate:'',current:true,location:'Boston, MA'}],
        education:[{id:'edu-1',label:'Example University',degree:'Bachelor of Science',school:'Example University',startDate:'2014-09',endDate:'2018-05',location:'Boston, MA'}],
        certifications:[{id:'cert-1',name:'Professional Cloud Architect',issuer:'Example Certification Institute',issuedOn:'2024-06',expiresOn:'2027-06',url:''}]},
      bindings:{experience:['role-1'],education:['edu-1']},
      resume:{company:'Example Employer',title:'Senior Software Engineer',summary:'Software engineer building reliable services and clear interfaces. Experienced in distributed systems, operational improvements, delivery planning, automated testing, and collaboration across engineering and product teams.',
        skills:[{Engineering:['JavaScript','TypeScript','Python','Distributed systems','Automated testing']},{Platforms:['Cloud infrastructure','Containers','Continuous delivery','Observability']}],
        experience:[{title:'Senior Software Engineer',company:'Northstar Systems',sentences:[
          'Delivered reliable services and improved operational visibility across product teams by designing maintainable interfaces, strengthening automated checks, and working closely with engineers to identify production risks before release. Continuously refined deployment workflows and documentation to support consistent delivery.\nContinuation sentinel demonstrates that a new line aligns with the first word after the bullet.',
          'Led technical reviews and coordinated implementation work across frontend, backend, and infrastructure teams. Documented architectural decisions and improved incident response practices to keep complex changes understandable and sustainable.']}],education:[{degree:'Bachelor of Science in Computer Science'}]} };
  }
  async function render(snapshot) {
    renderer.Mc(snapshot);
    const family=renderer.Rc.find(family=>family.id===snapshot.formattingOverrides.fontFamily);
    renderer.rawFonts=Object.fromEntries(await Promise.all([family.regular,family.bold].map(async face=>[face.key,await readFile(`extension/fonts/${face.file}`)])));
    renderer.fonts=vm.runInContext('Object.fromEntries(Object.entries(rawFonts).map(([key,value])=>[key,new Uint8Array(value)]))',renderer);
    return renderer.dp(renderer.fonts,snapshot,null,'2026-11-08T18:00:00.000Z');
  }
  function trace(snapshot) {
    const pages=[],text=[];
    const pdf={getPageCount:()=>pages.length,addPage(){const page={drawText(value,options){text.push({text:value,...options,page:pages.length-1});},drawRectangle(){},drawLine(){},drawCircle(){}};pages.push(page);return page;},getPage:index=>pages[index],getPages:()=>pages};
    const font={getCharacterSet:()=>[...Array(1024).keys(),8226],widthOfTextAtSize:(text,size)=>text.length*size*.5};
    const content=renderer.Aw(pdf,{regular:font,bold:font},snapshot,null);
    return {text,content,pages:pages.length};
  }
  return {fixture,render,trace,runtime:renderer};
}
