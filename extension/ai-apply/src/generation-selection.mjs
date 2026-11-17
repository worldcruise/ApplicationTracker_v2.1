export const GENERATION_MODULES=[['job','JD'],['resume','Resume'],['coverLetter','Cover letter']];
export const generationResultKey=run=>run.captureRevision>0?run.id+':capture:'+run.captureRevision:run.id;
export function selectedDocumentSettings(job,settings={}){
 const selectedModules=job?.selectedModules??settings.selectedModules??['job','resume',...(settings.includeCoverLetter===false?[]:['coverLetter'])];
 if(!Array.isArray(selectedModules)||!selectedModules.length)throw Error('Select at least one section to generate.');
 if(selectedModules.some(key=>!GENERATION_MODULES.some(([id])=>id===key))||new Set(selectedModules).size!==selectedModules.length)throw Error('Invalid generation selection.');
 return {...settings,selectedModules:[...selectedModules],includeJobAnalysis:selectedModules.includes('job'),includeResume:selectedModules.includes('resume'),includeCoverLetter:selectedModules.includes('coverLetter')};
}
export function sameGenerationSelection(left={},right={}){return ['includeJobAnalysis','includeResume','includeCoverLetter'].every(key=>(left[key]!==false)===(right[key]!==false));}
