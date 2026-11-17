export function queueJobKey(value){
  try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))return '';url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key))url.searchParams.delete(key);url.searchParams.sort();return url.href;}catch{return '';}
}
export function parseQueueCsv(source){
  const rows=[],row=[];let cell='',quoted=false,closed=false;
  function finishCell(){row.push(cell);cell='';closed=false;}
  function finishRow(){finishCell();if(row.some(value=>value.trim()))rows.push([...row]);row.length=0;}
  const text=source.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){if(char==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=char;continue;}
    if(char===','){finishCell();continue;}
    if(char==='\r'||char==='\n'){if(char==='\r'&&text[i+1]==='\n')i++;finishRow();continue;}
    if(closed){if(/\s/.test(char))continue;throw Error('The CSV has unexpected text after a quoted field.');}
    if(char==='"'){if(cell)throw Error('The CSV has an unexpected quote.');quoted=true;}else cell+=char;
  }
  if(quoted)throw Error('The CSV has an unfinished quoted field.');
  if(cell||row.length||closed)finishRow();
  const expected=['company','role','jd','salary','application link'],headers=rows.shift()?.map(value=>value.trim().toLowerCase())||[];
  if(headers.length!==5||expected.some(header=>headers.filter(value=>value===header).length!==1))throw Error('Use a CSV with Company, Role, JD, Salary, and Application link columns.');
  if(!rows.length)throw Error('This CSV does not contain any jobs.');
  if(rows.length>1000)throw Error('Import up to 1,000 rows at a time.');
  return rows.map((values,index)=>{
    if(values.length!==headers.length)throw Error(`CSV row ${index+2} must have five fields.`);
    const read=name=>values[headers.indexOf(name)];
    return {company:read('company'),role:read('role'),description:read('jd'),salary:read('salary'),url:read('application link')};
  });
}
export function queueImportMessage(report){return `Imported ${report.imported} jobs. Skipped ${report.skipped} duplicates.${report.failed?` ${report.failed} could not be imported.`:''}`;}
