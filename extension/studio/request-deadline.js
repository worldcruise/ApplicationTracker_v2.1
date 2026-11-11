// A disconnected extension document must not leave controls waiting forever.
export function withRequestDeadline(request,timeoutMs=10000,message='The extension did not respond. Refresh this page to reconnect, then try again.'){
  let timer;
  return Promise.race([Promise.resolve(request),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error(message),{code:'RESPONSE_TIMEOUT'})),timeoutMs);})]).finally(()=>clearTimeout(timer));
}
