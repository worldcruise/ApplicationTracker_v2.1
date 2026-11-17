const text=value=>typeof value==='string'?value.trim():'';
const rows=value=>Array.isArray(value)?value:[];
const sentence=value=>{const clean=text(value);return clean?clean+(/[.!?]$/.test(clean)?'':'.'):'';};

// The candidate_profile placeholder contains only the saved career timeline.
export function formatCandidateTimeline(profile){
  const work=rows(profile.roles).map(role=>{
    const context=[text(role.dates),text(role.location)].filter(Boolean).join(' - ');
    return sentence([text(role.company),context].filter(Boolean).join(', '));
  });
  const education=rows(profile.education).map(entry=>[sentence(entry.description),sentence(entry.dates)].filter(Boolean).join(' '));
  return [...work,...education].filter(Boolean).join('\n');
}

