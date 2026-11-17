// Demo data only: keep real/user-edited appointments fixed. Reserve each unique
// appointment once, including screening/interview history shared across rounds.
export function refineSampleSchedule(records,now=Date.now(),fixedApplications=new Set()){
  const rows=structuredClone(records),appointments=new Map(),reserved=[],gap=15*60000;
  function collect(row,locked=false){
    const meeting=row.meeting,start=Date.parse(meeting?.startsAt),end=Date.parse(meeting?.endsAt);
    if(meeting&&Number.isFinite(start)&&end>start){
      const fixed=locked||!row.isMock&&!row.id?.startsWith('mock-')||!!meeting.updatedAt||!!meeting.applicationStage||!!meeting.review?.completedAt;
      const id=row.id;let entry=appointments.get(id);
      if(!entry){entry={start,end,fixed,refs:[]};appointments.set(id,entry);}else entry.fixed||=fixed;
      entry.refs.push(row);
    }
    for(const previous of row.meetingHistory||[])collect(previous,locked||!!meeting?.updatedAt||!!meeting?.applicationStage);
  }
  for(const row of rows)collect(row,fixedApplications.has(row.applicationId));
  const conflicts=(start,end)=>reserved.filter(slot=>start<slot.end+gap&&end+gap>slot.start);
  const entries=[...appointments.values()];
  // In-progress meetings retain their current status and exact times.
  for(const entry of entries)if(entry.fixed||entry.start<=Number(now)&&entry.end>Number(now)){entry.fixed=true;reserved.push(entry);}
  const past=entries.filter(entry=>!entry.fixed&&entry.end<=Number(now)).sort((a,b)=>b.end-a.end);
  const future=entries.filter(entry=>!entry.fixed&&entry.end>Number(now)).sort((a,b)=>a.start-b.start);
  for(const entry of [...past,...future]){
    const duration=entry.end-entry.start,backwards=entry.end<=Number(now);let start=entry.start,end=entry.end,collisions;
    while((collisions=conflicts(start,end)).length){
      if(backwards){end=Math.min(...collisions.map(slot=>slot.start))-gap;start=end-duration;}
      else{start=Math.max(...collisions.map(slot=>slot.end))+gap;end=start+duration;}
    }
    if(start!==entry.start){
      for(const row of entry.refs){
        const startsAt=new Date(start).toISOString(),endsAt=new Date(end).toISOString();
        if(row.date===row.meeting.startsAt)row.date=startsAt;
        row.meeting.startsAt=startsAt;row.meeting.endsAt=endsAt;
        for(const history of row.meeting.scheduleHistory||[]){history.nextStartsAt=startsAt;history.nextEndsAt=endsAt;}
      }
    }
    reserved.push({start,end});
  }
  return rows;
}
