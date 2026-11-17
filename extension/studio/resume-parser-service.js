// Resume uploads call their parser directly.
// It has no account SDK, refresh timers, relays, or cloud application mutations.
export async function parseResumeFile({base64,fileName},{browser=chrome,fetch:request=globalThis.fetch}={}){
  if(typeof base64!=='string'||typeof fileName!=='string')throw Error('Choose a PDF or DOCX resume.');
  const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0)),body=new FormData();
  body.append('resume',new Blob([bytes],{type:/\.docx$/i.test(fileName)?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/pdf'}),fileName);
  const response=await request('https://www.speedyapply.com/api/ext/resume',{method:'POST',body,credentials:'include',headers:{'X-Ext-Version':browser.runtime.getManifest().version,'X-Ext-Browser':'chrome'}});
  if(!response.ok)throw Error(`Resume parsing failed: ${response.status} ${response.statusText}`);
  const profile=await response.json();if(!profile||typeof profile!=='object'||Array.isArray(profile))throw Error('The resume service returned an invalid profile.');
  return profile;
}
