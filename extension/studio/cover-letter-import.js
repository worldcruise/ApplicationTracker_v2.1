export async function readCoverLetter(file, loadPdf = () => import('../pdfjs/pdf.min.mjs')) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!['txt', 'md', 'pdf'].includes(extension)) throw Error('Choose a .txt, .md, or .pdf cover letter.');
  if (file.size > (extension === 'pdf' ? 6 * 1024 * 1024 : 128 * 1024)) throw Error(extension === 'pdf' ? 'Cover-letter PDF must be at most 6 MiB.' : 'Cover letter must be at most 128 KiB.');
  if (extension !== 'pdf') return file.text();
  const pdf = await loadPdf();
  pdf.GlobalWorkerOptions.workerSrc = new URL('../pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const task = pdf.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useWasm: false});
  try {
    const document = await task.promise, pages = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number), content = await page.getTextContent();
      pages.push(content.items.map(item => typeof item.str === 'string' ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim());
    }
    const text = pages.join('\n\n').trim();
    if (!text) throw Error('This PDF has no readable text. Import a text-based PDF or paste the cover letter.');
    if (new TextEncoder().encode(text).length > 128 * 1024) throw Error('Extracted cover letter must be at most 128 KiB.');
    return text;
  } finally { await task.destroy(); }
}
