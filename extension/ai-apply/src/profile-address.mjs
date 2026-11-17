import {profileValues} from '../../studio/profile-values.js';
import {phoneCountryCodes} from '../../studio/phone-country-codes.js';

const names=new Intl.DisplayNames(['en'],{type:'region'}),normalize=value=>String(value||'').trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const aliases={'United States of America':'US','United Kingdom':'GB','South Korea':'KR','North Korea':'KP','Russia':'RU','Taiwan':'TW','Turkey':'TR','Vietnam':'VN'};
export function addressCountryCode(country){return aliases[country]||phoneCountryCodes.find(item=>normalize(names.of(item.iso))===normalize(country))?.iso||'';}
function countryName(code){return profileValues.countries.find(country=>addressCountryCode(country)===code)||'';}

export function createAddressLookup(fetcher=globalThis.fetch){
  const post=async(path,payload,signal)=>{const response=await fetcher('https://www.speedyapply.com/api/places/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});if(!response.ok)throw Error('Address lookup is temporarily unavailable.');return response.json();};
  return {
    async search({field,value,address,session,signal}){
      if(field==='postalCode'){
        const code=addressCountryCode(address.country);if(!code)throw Error('Choose a country to look up its postal code.');
        const response=await fetcher(`https://api.zippopotam.us/${code.toLowerCase()}/${encodeURIComponent(value.trim())}`,{signal});if(response.status===404)return[];if(!response.ok)throw Error('Postal lookup is temporarily unavailable.');
        const data=await response.json();return(data.places||[]).slice(0,20).map((place,index)=>({id:'postal-'+index,label:place['place name'],description:[place.state,data['post code'],countryName(code)].filter(Boolean).join(', '),address:{city:place['place name']||'',state:place.state||place['state abbreviation']||'',country:countryName(code),postalCode:value.trim()}}));
      }
      const input=field==='line1'?value:[value,address.state,address.country].filter(Boolean).join(', ');
      const result=await post('autocomplete',{input,session,country:address.country||undefined},signal);
      return(result.suggestions||[]).slice(0,8).map(item=>({id:item.placeId,label:item.mainText,description:item.secondaryText}));
    },
    resolve:({item,session,signal})=>item.address||post('details',{placeId:item.id,session},signal)
  };
}

// Each lookup is tied to the complete current address, so a late reply cannot
// replace a city or postcode the user has just corrected.
export function connectAddressFields({inputs,address,lookup=createAddressLookup(),delay=350}){
  const doc=inputs.line1.ownerDocument,win=doc.defaultView,removers=[];let generation=0,timer=null,request=null,disposed=false,session=crypto.randomUUID(),open=null;
  const status=doc.createElement('p');status.className='af-address-status';status.setAttribute('aria-live','polite');inputs.postalCode.parentElement.append(status);
  function close(){if(open){open.list.remove();open.input.setAttribute('aria-expanded','false');open.input.removeAttribute('aria-activedescendant');open=null;}}
  function invalidate(){generation++;win.clearTimeout(timer);request?.abort();close();}
  const on=(node,type,listener)=>{node.addEventListener(type,listener);removers.push(()=>node.removeEventListener(type,listener));};
  function patch(value,field,snapshot){
    if(disposed||JSON.stringify(address)!==snapshot)return;
    const keys=field==='line1'?['line1','line2','city','state','postalCode','country']:['city','state','postalCode','country'];
    for(const key of keys){const next=value?.[key];if(typeof next!=='string'||!next.trim()||key==='country'&&!profileValues.countries.includes(next))continue;address[key]=next;inputs[key].value=next;}
    status.textContent='';session=crypto.randomUUID();
  }
  async function resolve(item,field,revision,snapshot){
    if(disposed||generation!==revision||JSON.stringify(address)!==snapshot)return;
    close();status.textContent='Looking up address details…';
    request?.abort();const controller=new AbortController();request=controller;const timeout=win.setTimeout(()=>controller.abort(),10000);
    try{const value=await lookup.resolve({item,session,signal:controller.signal});if(generation===revision){patch(value,field,snapshot);}}
    catch(error){if(!disposed&&generation===revision&&error.name!=='AbortError')status.textContent='Could not look up this address. You can enter the details manually.';}
    finally{win.clearTimeout(timeout);}
  }
  function suggest(items,field,revision,snapshot){
    close();const input=inputs[field],list=doc.createElement('div');list.className='af-address-suggestions';list.id='af-address-'+crypto.randomUUID();list.setAttribute('role','listbox');list.setAttribute('aria-label','Matching addresses');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','true');
    open={input,list,index:-1,items,field,revision,snapshot};
    for(const [index,item]of items.entries()){const button=doc.createElement('button');button.type='button';button.id=list.id+'-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');const label=doc.createElement('strong'),detail=doc.createElement('span');label.textContent=item.label;detail.textContent=item.description||'';button.append(label,detail);button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>void resolve(item,field,revision,snapshot));list.append(button);}input.parentElement.append(list);
    status.textContent='Choose a match to fill the related address fields.';
  }
  async function search(field){
    const value=inputs[field].value.trim();if(value.length<(field==='city'?2:3))return;
    const revision=generation,snapshot=JSON.stringify(address),controller=new AbortController();request=controller;const timeout=win.setTimeout(()=>controller.abort(),10000);status.textContent=field==='postalCode'?'Looking up postal code…':'Searching addresses…';
    try{const items=await lookup.search({field,value,address:{...address},session,signal:request.signal});if(disposed||revision!==generation||JSON.stringify(address)!==snapshot)return;
      if(!items.length){status.textContent='No match found. You can enter the address manually.';return;}
      const uniquePostal=field==='postalCode'&&items.every(item=>JSON.stringify(item.address)===JSON.stringify(items[0].address));
      if(uniquePostal)patch(items[0].address,field,snapshot);else suggest(items,field,revision,snapshot);
    }catch(error){if(!disposed&&revision===generation)status.textContent=error.name==='AbortError'?'Lookup timed out. You can enter the address manually.':error.message;}finally{win.clearTimeout(timeout);}
  }
  for(const [field,input]of Object.entries(inputs)){
    input.autocomplete=({line1:'address-line1',line2:'address-line2',city:'address-level2',state:'address-level1',postalCode:'postal-code',country:'country-name'})[field];
    if(['line1','city','postalCode'].includes(field)){input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');}
    on(input,'input',()=>{address[field]=input.value;invalidate();status.textContent='';if(['line1','city','postalCode'].includes(field))timer=win.setTimeout(()=>void search(field),delay);});
    on(input,'change',()=>{address[field]=input.value;if(field==='country'){invalidate();status.textContent='';if(address.postalCode)timer=win.setTimeout(()=>void search('postalCode'),delay);}});
    on(input,'keydown',event=>{if(!open||open.input!==input)return;if(event.key==='Escape'){event.preventDefault();invalidate();}else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open.index=(open.index+(event.key==='ArrowDown'?1:-1)+open.items.length)%open.items.length;for(const [index,button]of [...open.list.children].entries())button.setAttribute('aria-selected',String(index===open.index));input.setAttribute('aria-activedescendant',open.list.children[open.index].id);}else if(event.key==='Enter'&&open.index>=0){event.preventDefault();void resolve(open.items[open.index],open.field,open.revision,open.snapshot);}});
  }
  on(doc,'pointerdown',event=>{if(open&&event.target!==open.input&&!open.list.contains(event.target))invalidate();});
  return {dispose(){disposed=true;invalidate();removers.forEach(remove=>remove());status.remove();}};
}
