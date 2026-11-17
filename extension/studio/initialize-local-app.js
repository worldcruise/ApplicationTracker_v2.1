export function initializeLocalApp(browser=chrome){
  void Promise.resolve(browser.runtime.setUninstallURL?.('')).catch(()=>{});
  const initialize=async()=>{
    const saved=await browser.storage.local.get(['appliedList','dailyGoal']),defaults={};
    if(saved.appliedList===undefined)defaults.appliedList=[];
    if(saved.dailyGoal===undefined)defaults.dailyGoal=10;
    if(Object.keys(defaults).length)await browser.storage.local.set(defaults);
  };
  browser.runtime.onInstalled.addListener(()=>{void initialize().catch(error=>console.error('Application initialization failed',error));});
  return {initialize};
}
