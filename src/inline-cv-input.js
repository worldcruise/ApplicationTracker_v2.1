// Inline queue actions open the existing extension-origin CV editor through
// onResumeInput. Do not ship its file picker, folder database, or PDF parser
// into the employer page's content-script bundle.
export function mountQueueResumeInput(){
  return {sync(){},close(){},open(){throw Error('Open CV input in the extension page.');}};
}
