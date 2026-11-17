const encoder=new TextEncoder();

function safeName(value,fallback,limit){
  const source=String(value??'').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/\s+/g,' ').trim();
  let result='';
  for(const character of source){if(result.length+character.length>limit||encoder.encode(result+character).length>180)break;result+=character;}
  result=result.replace(/[. ]+$/g,'')||fallback;
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result)?'_'+result:result;
}

export const documentCompanyFolder=company=>safeName(company,'Applications',140);
export const documentExportCompany=run=>run.result?.job?.company||run.result?.document?.job?.company||run.job?.input?.job?.company||run.result?.resume?.company||run.job?.company;
export const applicationPDFFilename=(name,kind)=>kind==='cover-letter'||kind==='letter'?'cover letter.pdf':safeName(name,'Resume',140)+'.pdf';
