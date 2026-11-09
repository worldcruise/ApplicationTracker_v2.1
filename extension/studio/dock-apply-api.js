// Keep requests on the same existing SpeedyApply endpoints and auth stack.
// The injected functions are the shipped background client's validated adapters.
export function createDockApplyApi({request,profileSchema,authenticated,selectedProfile,lastSyncedProfile,fetchProfile,storeJob,generate}) {
  return {
    async parseResume({base64,fileName}) {
      const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
      const body=new FormData();body.append('resume',new Blob([bytes],{type:/\.docx$/i.test(fileName)?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/pdf'}),fileName);
      return request({path:'/api/ext/resume',auth:false,requestOptions:{method:'POST',body},responseSchema:profileSchema.partial()});
    },
    async generateAnswer({profile,tabId,url,description,title,prompt}) {
      if(!await authenticated())throw Error('Sign in through the existing account controls on an application page to generate AI answers.');
      const id=(await selectedProfile(tabId))?.id||(await lastSyncedProfile())?.id;
      if(!id)throw Error('Sync the selected profile through the existing account before generating AI answers.');
      const remote=await fetchProfile(id,false),stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).filter(([key])=>key!=='resumeData').sort(([a],[b])=>a.localeCompare(b))):item);
      if(!remote||stable(remote)!==stable(profile))throw Error('The synced profile differs from this run. Sync this profile before generating, or enter the answer yourself.');
      await storeJob(tabId,description,title,true,url);
      const result=await generate(prompt,'Use only facts in the selected candidate profile. Do not invent qualifications, eligibility, availability or other personal facts. If information is missing, request it from the candidate.',tabId,url,()=>{});
      if(!result?.text)throw Error('The existing answer service returned no draft. Enter an answer or try again.');
      return result.text;
    },
  };
}
