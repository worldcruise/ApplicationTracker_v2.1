import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from '../vendor/document-libraries.mjs';
import { normalizeDocumentSettings } from './document-settings.mjs';
import {renderStudioPDF} from './studio-pdf.mjs';
import {applicationPDFFilename} from '../../studio/document-paths.js';

const formats = {
  pdf: { mime: 'application/pdf', extension: 'pdf' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
  json: { mime: 'application/json', extension: 'json' }
};
const text = value => String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const joined = values => values.filter(Boolean).map(text).join(' · ');
const dates = value => [value.startDate, value.endDate].filter(Boolean).map(text).join(' – ');
const recordDetails = value => joined([dates(value), value.location]);
const encoder = new TextEncoder();

export function documentFilename(name, company, kind, format) {
  if(format==='pdf')return applicationPDFFilename(name,kind);
  const source = joined([name, company]).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim();
  let shortened = '';
  for (const character of source) {
    if (shortened.length + character.length > 110 || encoder.encode(shortened + character).length > 170) break;
    shortened += character;
  }
  const stem = shortened.replace(/[. ]+$/g, '') || 'Application';
  const safe = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ? '_' + stem : stem;
  return `${safe} - ${kind === 'cover-letter' ? 'Cover letter' : 'Resume'}.${formats[format].extension}`;
}

function blocksFor(run, kind) {
  const profile = run.job.input.profile, job = run.job.input.job, resume = run.result.resume;
  const blocks = [{ type: 'name', value: text(profile.name) }];
  if (kind === 'resume') blocks.push({ type: 'subtitle', value: text(resume.title) });
  const contact = joined(Object.values(resume?.contact || profile.contact || {}));
  if (contact) blocks.push({ type: 'contact', value: contact });
  if (kind === 'cover-letter') {
    blocks.push({ type: 'section', value: 'Cover letter' });
    const context = joined([job.company, job.role]);
    if (context) blocks.push({ type: 'record', value: context });
    for (const paragraph of text(run.result.coverLetter).split(/\n\s*\n/).filter(Boolean)) blocks.push({ type: 'paragraph', value: paragraph });
    return blocks;
  }
  blocks.push({ type: 'section', value: 'Summary' }, { type: 'paragraph', value: text(resume.summary) });
  if (resume.skills?.length) {
    blocks.push({ type: 'section', value: 'Skills' });
    for (const group of resume.skills) for (const [name, values] of Object.entries(group)) {
      blocks.push({ type: 'paragraph', value: `${text(name)}: ${values.map(text).join(', ')}` });
    }
  }
  if (resume.experience?.length) {
    blocks.push({ type: 'section', value: 'Experience' });
    for (const item of resume.experience) {
      blocks.push({ type: 'record', value: joined([item.title, item.company]) });
      const details = recordDetails(item);
      if (details) blocks.push({ type: 'contact', value: details });
      for (const sentence of item.sentences || []) blocks.push({ type: 'bullet', value: text(sentence) });
    }
  }
  if (resume.education?.length) {
    blocks.push({ type: 'section', value: 'Education' });
    for (const item of resume.education) {
      blocks.push({ type: 'record', value: joined([item.degree, item.institution]) });
      const details = recordDetails(item);
      if (details) blocks.push({ type: 'contact', value: details });
    }
  }
  return blocks;
}

function wordParagraph(block) {
  const style = {
    name: { size: 44, bold: true, after: 90 },
    subtitle: { size: 24, after: 100 },
    contact: { size: 18, color: '596673', after: 90 },
    section: { size: 22, bold: true, color: '194859', before: 240, after: 110 },
    record: { size: 21, bold: true, before: 120, after: 70 },
    paragraph: { size: 21, after: 110 },
    bullet: { size: 21, after: 70 }
  }[block.type];
  const lines = block.value.split('\n');
  const children = lines.map((value, index) => new TextRun({ text: value, font: 'Calibri', size: style.size, bold: style.bold, color: style.color || '1F2933', ...(index ? { break: 1 } : {}) }));
  return new Paragraph({ children, alignment: AlignmentType.LEFT,
    ...(block.type === 'section' ? { heading: HeadingLevel.HEADING_1 } : {}),
    ...(block.type === 'bullet' ? { bullet: { level: 0 } } : {}),
    keepNext: ['name', 'subtitle', 'section', 'record'].includes(block.type),
    spacing: { before: style.before || 0, after: style.after, line: 280 },
    widowControl: true
  });
}

async function wordBytes(run, kind, blocks) {
  const doc = new Document({ creator: 'AI Agent Template', title: `${run.job.input.profile.name} · ${kind === 'resume' ? 'Resume' : 'Cover letter'}`,
    description: joined([run.job.input.job.company, run.job.input.job.role]),
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 960, bottom: 960, left: 960, right: 960 } } }, children: blocks.map(wordParagraph) }]
  });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exportDocuments(run, { renderPDF = renderStudioPDF, kinds: selectedKinds } = {}) {
  if (run?.phase !== 'complete' || !run.result || !run.job?.input?.profile) throw new Error('Only validated, completed documents can be downloaded.');
  const settings = normalizeDocumentSettings(run.documentSettings), files = [], errors = [];
  let kinds = settings.includeResume!==false&&run.result.resume?['resume']:[];
  if (settings.includeCoverLetter && run.result.coverLetter?.trim()) kinds.push('cover-letter');
  if (selectedKinds) kinds = kinds.filter(kind => selectedKinds.includes(kind));
  if (!kinds.length&&selectedKinds) throw new Error('The selected saved document is unavailable.');
  if(!kinds.length&&run.outputFormat==='combined-json'&&settings.formats.includes('json')){
    const previewText=JSON.stringify(run.result.document,null,2)+'\n';
    files.push({kind:'resume',format:'json',filename:documentFilename(run.job.input.profile.name,run.job.input.job.company,'resume','json').replace(' - Resume.json',' - Documents.json'),mime:formats.json.mime,bytes:encoder.encode(previewText),previewText});
  }
  for (const format of settings.formats) for (const kind of kinds) {
    try {
      if(format==='json'&&run.outputFormat==='combined-json'){
        if(kind!==kinds[0])continue;
        const document=run.result.document||{resume:run.result.resume,...settings.includeCoverLetter&&run.result.coverLetter?.trim()?{coverLetter:run.result.coverLetter}:{}};
        const previewText=JSON.stringify(document,null,2)+'\n';
        files.push({kind:'resume',format:'json',filename:documentFilename(run.job.input.profile.name,run.job.input.job.company,'resume','json').replace(' - Resume.json',' - Documents.json'),mime:formats.json.mime,bytes:encoder.encode(previewText),previewText});continue;
      }
      const blocks = format === 'json' ? null : blocksFor(run, kind);
      const envelope = { schemaVersion: 1, requestId: run.jobId || run.job.id, runId: run.id,
        ...(kind === 'resume' ? { resume: run.result.resume } : { coverLetter: run.result.coverLetter }) };
      const previewText = format === 'json' ? JSON.stringify(envelope, null, 2) + '\n' : blocks.map(block => (block.type === 'bullet' ? '• ' : '') + block.value).join('\n\n');
      const bytes = format === 'pdf' ? Uint8Array.from(atob((await renderPDF(run,kind)).base64),character=>character.charCodeAt(0)) : format === 'docx' ? await wordBytes(run, kind, blocks) : encoder.encode(previewText);
      files.push({ kind, format, filename: documentFilename(run.job.input.profile.name, run.job.input.job.company, kind, format), mime: formats[format].mime, bytes, previewText });
    } catch (error) {
      errors.push({ kind, format, message: error.message || `The ${format.toUpperCase()} document could not be created.` });
    }
  }
  return { files, errors };
}
