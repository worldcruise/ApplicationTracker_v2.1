import { EMBED_RULE_ID, DEEPSEEK_EMBED_RULE_ID, embedRules, deepseekEmbedRules } from './sidebar-protocol.mjs';
import { createJobExtractionService } from './job-extraction-service.mjs';
import { createGenerationService } from './generation-service.mjs';
import { createDocumentDownloads } from './document-downloads.mjs';
import { resolveApplicationUrls } from './job-apply-url.mjs';
import { createResumeBatch } from './resume-batch.mjs';

export function initializeTemplateWorker({authorizeUI,isUI,readPageCommands,readResumePrompt,writeToDirectory}) {
const documentDownloads = createDocumentDownloads({writeToDirectory,onChange: run => ['complete','failed','partial','skipped'].includes(run?.downloads?.state) ? resumeBatch.tick() : undefined });
const generations = createGenerationService({readResumePrompt,onComplete: async run => { await documentDownloads.start(run); await resumeBatch.tick(); } });
const resumeBatch = createResumeBatch({ generations });
void resumeBatch.tick().catch(() => {});
void documentDownloads.reconnect().catch(() => {});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message?.type?.startsWith('generation.')) return false;
  const ui = isUI(sender);
  let task;
  if (ui && message.type === 'generation.start') task = () => generations.start(message.jobId, message.provider);
  if (ui && message.type === 'generation.copy-prompt') task = () => generations.copyPrompt(message.jobId);
  if (ui && message.type === 'generation.batch-start') task = () => resumeBatch.start(message.candidateId, message.provider);
  if (ui && message.type === 'generation.batch-stop') task = () => resumeBatch.stop();
  if (ui && message.type === 'generation.capture') task = () => generations.startCapture(message.jobId,message.provider);
  if (ui && message.type === 'generation.apply-urls') task = () => resolveApplicationUrls(message.tabId,message.sourceUrl);
  if (ui && message.type === 'generation.list') task = async () => {
    const runs = await generations.list({ health: message.health === true });
    if (message.reconnect) void generations.reconnect().catch(() => {});
    return runs;
  };
  if (ui && message.type === 'generation.read') task = () => generations.read(message.id);
  if (ui && message.type === 'generation.import-result') task = () => generations.importResult(message.jobId,message.payload);
  if (ui && message.type === 'generation.open') task = () => generations.open(message.id, message.resume === true);
  if (ui && message.type === 'generation.refetch') task = () => generations.refetch(message.id);
  if (ui && message.type === 'generation.stop') task = () => generations.stop(message.id);
  if (ui && message.type === 'generation.download') task = () => documentDownloads.start(message.id, { manual: true });
  if (ui && message.type === 'generation.download-saved') task = () => documentDownloads.startSaved(message.jobId, message.kind);
  if (!ui && message.type === 'generation.attach') task = () => generations.attach(message.id, message.actorId, sender);
  if (!ui && message.type === 'generation.event') task = () => generations.event(message.id, message.actorId, message.data || {}, sender);
  if (!task) return false;
  Promise.resolve().then(async()=>{if(ui)await authorizeUI(sender);return task();}).then(value => respond({ ok: true, value }), error => respond({ ok: false, code: error.code || 'generation-denied', error: error.message || 'The generation could not continue.' })).finally(() => {
    if(message.type==='generation.event' && message.data?.kind!=='heartbeat' || message.type==='generation.stop' || message.type==='generation.list'&&(message.health||message.reconnect)) void resumeBatch.tick().catch(() => {});
  });
  return true;
});

const extractJob = createJobExtractionService();
const handleReadPageCommand = readPageCommands.handle;
chrome.commands.onCommand.addListener(handleReadPageCommand);

let configuring;
function configureSidebar() {
  if (!configuring) {
    configuring = Promise.all([
      // Handle the action ourselves so Chrome grants activeTab before opening
      // the panel. The automatic side-panel action skips that permission grant.
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }),
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [EMBED_RULE_ID, DEEPSEEK_EMBED_RULE_ID],
        addRules: [...embedRules(chrome.runtime.id), ...deepseekEmbedRules(chrome.runtime.id)]
      })
    ]).catch(error => {
      configuring = null;
      throw error;
    });
  }
  return configuring;
}

chrome.runtime.onInstalled.addListener(() => {
  void configureSidebar().catch(error => console.error('Sidebar setup failed:', error));
});
chrome.runtime.onStartup.addListener(() => {
  void configureSidebar().catch(error => console.error('Sidebar setup failed:', error));
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !isUI(sender)) return false;
  if (message?.type === 'job.read-command.take' && Number.isInteger(message.windowId)) {
    authorizeUI(sender).then(()=>respond({ok:true,request:readPageCommands.take(sender.tab?.windowId??message.windowId)}),error=>respond({ok:false,error:error.message}));
    return true;
  }
  if (message?.type === 'job.extract' && typeof message.requestId==='string' && /^[\w-]{1,100}$/.test(message.requestId)) {
    authorizeUI(sender).then(()=>extractJob(message.tabId)).then(
      result => respond({ok:true,requestId:message.requestId,...result}),
      error => respond({ok:false,requestId:message.requestId,error:{code:error.code || 'extraction-failed',message:error.message || 'Could not read this job page. Try again.'}})
    );
    return true;
  }
  if (message?.type !== 'sidebar.initialize') return false;
  authorizeUI(sender).then(()=>configureSidebar()).then(
    () => respond({ ok: true }),
    () => respond({ ok: false, error: 'The sidebar could not start. Reload the extension and try again.' })
  );
  return true;
});

void configureSidebar().catch(error => console.error('Sidebar setup failed:', error));

}
