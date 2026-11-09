export const QUEUE_SAMPLES=[
  {key:'northstar',company:'Northstar Systems',role:'Frontend Engineer',description:'Sample listing: build accessible React interfaces, improve page performance, and collaborate with design and product teams.'},
  {key:'harbor',company:'Harbor Analytics',role:'Data Analyst',description:'Sample listing: explore product data, build SQL reports, and communicate clear findings to business teams.'},
  {key:'orbit',company:'Orbit Labs',role:'Full Stack Developer',description:'Sample listing: develop web applications, maintain APIs, and work with engineers on reliable releases.'},
  {key:'cedar',company:'Cedar Health',role:'Product Designer',description:'Sample listing: research user needs, prototype accessible workflows, and maintain a consistent design system.'},
  {key:'summit',company:'Summit Cloud',role:'Platform Engineer',description:'Sample listing: improve deployment tooling, observe production systems, and help teams operate reliable services.'},
];

export function sampleResume(candidate,sample){
  const skills=candidate.profile?.skillsData||[];
  return {company:sample.company,title:sample.role,summary:'Sample resume preview for the job-queue interface. Replace this sample with a real job and your prepared resume before applying.',
    skills:skills.length?[{Skills:skills.slice()}]:[],experience:[],education:[]};
}
