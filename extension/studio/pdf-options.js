// All document readers use the same packaged PDF.js resources, including offline.
export function pdfDocumentOptions(data){
  return {data,isEvalSupported:false,useWasm:false,useWorkerFetch:false,useSystemFonts:false,
    standardFontDataUrl:new URL('../pdfjs/standard_fonts/',import.meta.url).href,
    cMapUrl:new URL('../pdfjs/cmaps/',import.meta.url).href,cMapPacked:true};
}
