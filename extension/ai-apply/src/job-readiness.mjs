// Prepared documents take priority over stale generation/action flags.
export function canDownloadSavedDocument(record,kind){
  if(!record||record.documentsStale||record.aiApply?.documentsStale||record.state==='cancelled'||record.deletedAt||record.capturePending)return false;
  if(record.resume?.inputRevision!==undefined&&record.inputRevision!==undefined&&record.resume.inputRevision!==record.inputRevision)return false;
  return kind==='resume'?!!record.resume:kind==='cover-letter'&&record.coverLetterEnabled===true&&typeof record.coverLetter==='string'&&!!record.coverLetter.trim();
}

export function isJobReady(record){
  if(!record?.resume||record.documentsStale||record.aiApply?.documentsStale||record.state==='cancelled'||record.deletedAt||record.applicationId||record.capturePending)return false;
  if(record.resume.inputRevision!==undefined&&record.inputRevision!==undefined&&record.resume.inputRevision!==record.inputRevision)return false;
  const job=record.input?.job||record;
  const salary=job.salary;
  const hasSalary=typeof salary==='string'?!!salary.trim():!!salary&&(salary.min>0||salary.max>0);
  const details=job.salaryDetails;
  return typeof job.company==='string'&&!!job.company.trim()&&(hasSalary||!!details&&(details.min>0||details.max>0));
}
