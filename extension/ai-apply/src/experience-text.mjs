// Imported descriptions can contain empty lines or entire paragraphs. Keep the
// saved profile untouched; normalize its projection for the AI text contract.
export function normalizeExperienceSentences(value,{splitLong=false}={}) {
  if(!Array.isArray(value))return value;
  return value.flatMap(item=>{
    // Keep malformed values so the schema reports them instead of hiding data.
    if(typeof item!=='string')return [item];
    const lines=splitLong?item.split(/\r\n?|\n/):[item],result=[];
    for(const line of lines){
      let remaining=line.trim();
      while(splitLong&&remaining.length>3000){
        let boundary=Math.max(remaining.lastIndexOf(' ',3000),remaining.lastIndexOf('\t',3000));
        if(boundary<=0)boundary=3000;
        // Avoid splitting a UTF-16 surrogate pair when a long token has no spaces.
        if(/[\uD800-\uDBFF]/.test(remaining[boundary-1]))boundary--;
        result.push(remaining.slice(0,boundary).trim());
        remaining=remaining.slice(boundary).trimStart();
      }
      if(remaining)result.push(remaining);
    }
    return result;
  });
}
