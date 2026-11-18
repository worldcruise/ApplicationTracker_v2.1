const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const websiteKeys=['linkedin','github','website'];
const websiteVisibility=value=>Object.fromEntries(websiteKeys.map(key=>[key,value?.[key]!==false]));

export function createStudioHeaderPreferences({profiles,drafts,normalizeStyle}){
  async function load(candidateId){
    const candidate=candidateId?await profiles.get(candidateId):null;
    if(!candidate)return {candidate:null};
    const saved=await drafts.read(candidateId),preferences=candidate.document.applicationPreferences||{};
    const style=normalizeStyle(!saved.userEdited&&preferences.defaultDocumentStyle||saved.draft);
    const defaultStyle=preferences.defaultDocumentStyle?normalizeStyle(preferences.defaultDocumentStyle):null;
    const websites=websiteVisibility(preferences.resumeWebsiteVisibility),defaultWebsites=websiteVisibility(preferences.defaultDocumentStyle?.resumeWebsiteVisibility);
    return {candidate,style,isDefault:!!defaultStyle&&stable(style)===stable(defaultStyle)&&stable(websites)===stable(defaultWebsites),websites};
  }
  const view=value=>value.candidate?{candidateId:value.candidate.id,websites:value.websites,isDefault:value.isDefault}:{candidateId:null,websites:{linkedin:true,github:true,website:true},isDefault:true};
  return {async handle(candidateId,payload={}){
    const current=await load(candidateId);
    if(!payload.action)return view(current);
    if(!current.candidate)throw Error('Create your profile before saving resume preferences.');
    const document=structuredClone(current.candidate.document),preferences=document.applicationPreferences||{};
    if(payload.action==='websites'){
      if(typeof payload.visible!=='boolean'||payload.key!==undefined&&!websiteKeys.includes(payload.key))throw Error('Choose a resume website option.');
      const websites=payload.key?{...current.websites,[payload.key]:payload.visible}:Object.fromEntries(websiteKeys.map(key=>[key,payload.visible]));
      document.applicationPreferences={...preferences,resumeWebsiteVisibility:websites};
    }else if(payload.action==='default'){
      document.applicationPreferences={...preferences,preferredDocumentTemplateId:current.style.documentTemplate.id,defaultDocumentStyle:{...structuredClone(current.style),resumeWebsiteVisibility:current.websites}};
    }else throw Error('Choose a supported resume preference.');
    await profiles.save({candidateId,expectedRevision:current.candidate.revision,document,mutationId:crypto.randomUUID()});
    return view(await load(candidateId));
  }};
}
