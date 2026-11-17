export const PROMPT_TOKENS = {
  tasks:'{{tasks}}',finalOutput:'{{final_output}}',candidateProfile:'{{candidate_profile}}',jobDescription:'{{job_description}}',jobCompany:'{{job_company}}',jobTitle:'{{job_title}}',jobUrl:'{{job_url}}',
  candidateName:'{{candidate_name}}',candidateLocation:'{{candidate_location}}',candidateSeniority:'{{candidate_seniority}}',yearsOfExperience:'{{years_of_experience}}',
  company1:'{{company_1}}',company1Name:'{{company_1_name}}',company1Location:'{{company_1_location}}',company1Period:'{{company_1_period}}',company1Bullets:'{{company_1_bullets}}',
  company2:'{{company_2}}',company2Name:'{{company_2_name}}',company2Location:'{{company_2_location}}',company2Period:'{{company_2_period}}',company2Bullets:'{{company_2_bullets}}',
  education:'{{education}}',educationDegree:'{{education_degree}}',educationUniversity:'{{education_university}}',educationPeriod:'{{education_period}}',bulletCounts:'{{bullet_counts}}'
};
export function knownPromptToken(token){return Object.values(PROMPT_TOKENS).includes(token)||/^{{company_[1-9]\d*(?:_(?:name|location|period|bullets))?}}$/.test(token)||/^{{education_[1-9]\d*(?:_(?:degree|university|period))?}}$/.test(token);}
// Replace once: placeholder-shaped text inside a stored value remains literal.
export function substitutePromptPlaceholders(template,values,{emptyMissing=false}={}){return template.replace(/{{[^{}]*}}/g,token=>Object.hasOwn(values,token.slice(2,-2))?String(values[token.slice(2,-2)]??''):emptyMissing&&knownPromptToken(token)?'':token);}
