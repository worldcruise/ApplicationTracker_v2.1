export const SKILLS_FIRST_TEMPLATES = ['kakuna','rendercv-classic','moderncv-gutter','harvard','ember'];
export const skillsFirstTemplate = id => SKILLS_FIRST_TEMPLATES.includes(id);

export function resumeSectionOrder(id, settings = {}) {
  // Keep the version-1 template metadata compatible with existing frozen
  // snapshots; apply the effective content order when composing the document.
  if (skillsFirstTemplate(id)) return ['summary','skills','experience','education'];
  return ['summary','experience', ...(settings.educationBeforeSkills ? ['education','skills'] : ['skills','education'])];
}

// The marker has its own position; every body line uses the same hanging indent.
// Justification expands word gaps on wrapped lines, keeping final lines natural.
export function layoutResumeParagraph({ text, x, width, measure, wrap, bullet = false, justify = true }) {
  const advance = bullet ? measure('• ') : 0;
  const textX = x + advance, textWidth = Math.max(12,width - advance);
  const result = [];
  let row = 0;
  for (const paragraph of text.split(/\r?\n/)) {
    const lines = wrap(paragraph,textWidth);
    for (let index = 0; index < lines.length; index++, row++) {
      const line = lines[index], tokens = line.split(/ +/), gaps = tokens.length - 1;
      if (bullet && row === 0) result.push({ text:'•',x,width:advance,lineIndex:row,marker:true });
      const entry = { text:line,x:textX,width:textWidth,lineIndex:row };
      if (justify && index < lines.length - 1 && gaps > 0) {
        const extra = Math.max(0,(textWidth - measure(line)) / gaps);
        let cursor = textX;
        entry.words = tokens.map((word,wordIndex) => {
          const run = { text:word + (wordIndex < gaps ? ' ' : ''),x:cursor };
          cursor += measure(run.text) + (wordIndex < gaps ? extra : 0);
          return run;
        });
      }
      result.push(entry);
    }
  }
  return result;
}
