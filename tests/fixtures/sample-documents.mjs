const variant = value => [...value].reduce((total,letter)=>total+letter.charCodeAt(0),0);
export function sampleJobDescription(company,role){return `${role}\n${company}\n\nAbout the role\nJoin a collaborative team building useful products and services for customers. Work with partners across design, engineering, operations, and product to turn complex requirements into clear, reliable solutions.\n\nResponsibilities\n• Own projects from planning through delivery.\n• Collaborate across teams and communicate decisions clearly.\n• Improve customer workflows using research, feedback, and measurable outcomes.\n• Maintain quality, accessibility, and clear documentation.\n\nQualifications\nRelevant professional experience, strong problem-solving skills, and a thoughtful approach to teamwork.\n\nDemo job description for ${company}.`;}

export function sampleSalary(id,role='') {
  const base=/engineer|developer|architect/i.test(role)?125000:/design|product|manager/i.test(role)?110000:85000;
  const low=base+variant(id)%5*5000;
  return `$${low.toLocaleString('en-US')}–$${(low+30000).toLocaleString('en-US')} / year`;
}

export function sampleCoverLetter(id,company,role) {
  return variant(id)%2===0?'':`Dear ${company} hiring team,\n\nI am applying for the ${role} position. My experience delivering thoughtful solutions, working across teams, and turning complex requirements into clear outcomes would help me contribute to your team.\n\nAt Redwood Digital, I partnered with colleagues to improve customer workflows, document decisions, and deliver reliable releases. I would welcome the opportunity to bring that same care and curiosity to ${company}.\n\nThank you for considering my application. I look forward to discussing the role.\n\nBest regards,\nAlex Morgan`;
}

export function sampleApplicationDocuments(id,company,role,submittedAt) {
  const skills=/engineer|developer|architect/i.test(role)?['TypeScript','React','SQL','Automated testing']:/design/i.test(role)?['User research','Figma','Prototyping','Accessibility']:['Data analysis','Project planning','Stakeholder communication','Process improvement'];
  const cv={company,title:role,summary:`Experienced ${role.toLowerCase()} with a practical approach to solving customer problems, collaborating across teams, and delivering measurable improvements.`,skills:[{Expertise:skills}],
    experience:[{company:'Redwood Digital',title:role,sentences:['Delivered improvements to customer workflows in partnership with product, design, and engineering teams.','Introduced repeatable quality checks and clear documentation to support dependable releases.','Used customer feedback and team metrics to prioritize useful improvements.']}],education:[{degree:'Bachelor of Science'}]};
  const coverLetterRaw=sampleCoverLetter(id,company,role),documentTemplate={id:'rendercv-classic',version:1};
  const snapshot={candidate:{id:'mock-candidate:alex-morgan',name:'Alex Morgan'},documentTemplate,
    profile:{contact:['alex.morgan@example.com','New York, NY'],links:[],experience:[{id:'mock-work:redwood',company:'Redwood Digital',role,startDate:'2021-06',endDate:'2025-10',location:'New York, NY'}],education:[{id:'mock-education',school:'Example State University',degree:'Bachelor of Science',startDate:'2016-09',endDate:'2020-05'}]},
    bindings:{experience:['mock-work:redwood'],education:['mock-education']},resume:cv};
  return {resume:{cvJsonRaw:JSON.stringify(cv),coverLetterRaw,coverLetterEnabled:!!coverLetterRaw,documentTemplate,snapshot,version:1,savedAt:submittedAt},coverLetterRaw,coverLetterEnabled:!!coverLetterRaw};
}
