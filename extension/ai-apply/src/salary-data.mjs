export const emptySalary=()=>({min:0,max:0,currency:'USD',period:'year',sourceText:''});
export const structuredSalary=value=>!!value&&typeof value==='object'&&Object.hasOwn(value,'min');

export function validateSalary(value){
  const keys=['min','max','currency','period','sourceText'];
  if(!value||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw Error('job.salary must contain exactly min, max, currency, period, sourceText.');
  for(const key of ['min','max'])if(typeof value[key]!=='number'||!Number.isFinite(value[key]))throw Error('job.salary.'+key+' must be a finite number.');
  if(typeof value.currency!=='string'||value.currency.length>100)throw Error('job.salary.currency must be text under 100 characters.');
  if(typeof value.period!=='string'||value.period.length>100)throw Error('job.salary.period must be text under 100 characters.');
  if(typeof value.sourceText!=='string'||value.sourceText.length>2000)throw Error('job.salary.sourceText must be text under 2,000 characters.');
  return value;
}

export function salaryDisplay(value){
  validateSalary(value);
  if(!value.min&&!value.max)return '';
  const amount=number=>String(number);
  const range=value.min===value.max?amount(value.min):value.min&&value.max?amount(value.min)+'-'+amount(value.max):value.min?'from '+amount(value.min):'up to '+amount(value.max);
  return value.currency+' '+range+' per '+value.period;
}

// Saved prompt examples are not job evidence. Upgrade only their salary schema,
// leaving the user's remaining JSON template unchanged.
export function migrateSalaryTemplate(raw){
  try{const value=JSON.parse(raw),salary=value?.job?.salary;
    if(salary&&['value','source','evidence','basis'].every(key=>Object.hasOwn(salary,key))){value.job.salary=emptySalary();return JSON.stringify(value,null,2);}
  }catch{/* The editor reports invalid JSON rather than replacing it. */}
  return raw;
}
