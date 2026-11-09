import {normalizeProfile} from './profile-model.js';

// Import the prepared CV's tailored text into the existing factual profile.
// Stable Studio bindings identify each work entry; employer/degree facts stay
// in SpeedyApply's canonical schema rather than being inferred from CV text.
export function profileFromQueueResume(candidate,job,resumeData){
  const snapshot=job.resume?.snapshot,cv=snapshot?.resume;
  if(!cv||snapshot.candidate?.id!==candidate.id)throw Error('This saved resume belongs to another candidate.');
  const profile=structuredClone(candidate.profile),companies=candidate.document.companies||[];
  for(const [index,experience]of (cv.experience||[]).entries()){
    const binding=snapshot.bindings?.experience?.[index],target=companies.findIndex(company=>company.id===binding);
    if(!binding||target<0||!profile.jobData[target])throw Error('The saved resume no longer matches this profile’s work history. Prepare it again in Resume Studio.');
    profile.jobData[target].description=(experience.sentences||[]).join('\n');
  }
  const skills=[...new Set((cv.skills||[]).flatMap(section=>Object.values(section).flat()).filter(skill=>typeof skill==='string'&&skill.trim()).map(skill=>skill.trim()))];
  if(skills.length)profile.skillsData=skills.slice(0,25);
  if(resumeData)profile.resumeData=resumeData;
  return normalizeProfile(profile);
}

export function profileImportReview(profile){
  return {summary:`${profile.jobData.length} work entries, ${profile.educationData.length} education entries, ${profile.skillsData.length} skills`,changes:{
    work:profile.jobData.map(job=>[job.jobTitle,job.company,[job.startDate,job.currentlyWorkHere?'Present':job.endDate].filter(Boolean).join(' – '),job.description].filter(Boolean).join('\n')),
    education:profile.educationData.map(education=>[education.degree,education.fieldOfStudy,education.school,[education.startDate,education.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')),skills:profile.skillsData}};
}
