const clean=value=>String(value||'').trim();
const sentence=value=>clean(value).replace(/^\s*(?:[-–—•▪●◦‣]+|\d+[.)])\s*/,'').replace(/[•▪●◦‣]/g,' ').replace(/\s+/g,' ').trim();
const dateKey=value=>{const raw=clean(value),match=raw.match(/^(\d{1,2})\/(\d{4})$/);return match?`${match[2]}-${match[1].padStart(2,'0')}`:raw;};
export function resumeCVJSON({sections={},profile={}}){
  const name=[profile.nameData?.firstName,profile.nameData?.middleName,profile.nameData?.lastName].filter(Boolean).join(' '),work=profile.jobData||[],headerTitle=(sections.header||[]).find(line=>line!==name&&!/@|https?:|www\./i.test(line)&&/\b(engineer|developer|manager|analyst|architect|designer|director|specialist|consultant|technician|scientist|coordinator|administrator|president|founder|researcher)\b/i.test(line));
  const recent=[...work].sort((a,b)=>Number(b.currentlyWorkHere)-Number(a.currentlyWorkHere)||dateKey(b.endDate||b.startDate).localeCompare(dateKey(a.endDate||a.startDate)))[0];
  const categories=Object.create(null);let category='Skills';
  for(const source of sections.skills||[]){
    let line=source.replace(/^\s*[-•▪●]\s*/,''),match=line.match(/^([^:]{1,80}):\s*(.*)$/);
    if(match){category=clean(match[1]);line=match[2];}
    const skills=line.split(/[,;|•]/).map(clean).filter(Boolean);if(!skills.length)continue;
    categories[category]=[...new Set([...(categories[category]||[]),...skills])];
  }
  if(!Object.keys(categories).length&&profile.skillsData?.length)categories.Skills=[...new Set(profile.skillsData.map(clean).filter(Boolean))];
  return {company:'Unknown',title:clean(headerTitle||recent?.jobTitle)||'Unknown',summary:(sections.summary||[]).join(' ').trim(),
    skills:Object.keys(categories).length?[{...categories}]:[],
    experience:work.map(job=>({title:clean(job.jobTitle),company:clean(job.company),sentences:clean(job.description).split(/\r?\n/).map(sentence).filter(Boolean)})),
    education:(profile.educationData||[]).map(item=>({degree:[clean(item.degreeName||item.degree),clean(item.fieldOfStudy)].filter(Boolean).join(' in ')}))};
}
