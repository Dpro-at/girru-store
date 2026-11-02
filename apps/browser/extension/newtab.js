import {message} from './api.js';
import {searchAddress} from './search-url.js';
const $=id=>document.getElementById(id),key='girru.shortcuts.v1';let shortcuts=[],removed=null;
const webAddress=value=>{const raw=value.trim();if(!/^https?:\/\//i.test(raw)&&!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(raw)&&!/^[-\w.]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(raw))return null;return searchAddress(raw);};
$('search').onsubmit=event=>{event.preventDefault();const url=searchAddress($('query').value);if(url)location.assign(url);else message($('status'),'Enter a web address or search words.',true);};
$('extensions').onclick=()=>chrome.tabs.create({url:'chrome://extensions/'});
async function save(){await chrome.storage.local.set({[key]:shortcuts});render();}
function render(){
 $('shortcuts').replaceChildren();
 for(const item of shortcuts){const cell=document.createElement('div'),link=document.createElement('a'),icon=document.createElement('span'),name=document.createElement('span'),remove=document.createElement('button');cell.className='newtab-shortcut';link.href=item.url;link.title=item.url;icon.className='shortcut-symbol';icon.textContent=item.name.slice(0,1).toUpperCase();name.textContent=item.name;link.append(icon,name);remove.type='button';remove.className='shortcut-remove';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),cross=document.createElementNS('http://www.w3.org/2000/svg','path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');cross.setAttribute('d','m6 6 12 12M6 18 18 6');svg.append(cross);remove.append(svg);remove.setAttribute('aria-label','Remove '+item.name);remove.onclick=async()=>{const before=shortcuts;shortcuts=shortcuts.filter(x=>x.id!==item.id);try{await save();removed=item;$('undo-shortcut').hidden=false;message($('status'),'Shortcut removed.');}catch{shortcuts=before;render();message($('status'),'The shortcut could not be removed.',true);}};cell.append(link,remove);$('shortcuts').append(cell);}
 $('add-shortcut').hidden=shortcuts.length>=12;
}
try{const saved=(await chrome.storage.local.get(key))[key];if(Array.isArray(saved))shortcuts=saved.slice(0,12).filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&x.name.length>0&&x.name.length<=80&&typeof x.url==='string'&&webAddress(x.url)).map(x=>({id:x.id,name:x.name,url:webAddress(x.url)}));}catch{message($('status'),'Shortcuts could not be loaded.',true);}render();
$('add-shortcut').onclick=()=>{$('shortcut-form').reset();$('shortcut-error').textContent='';$('shortcut-dialog').showModal();$('shortcut-name').focus();};
$('shortcut-cancel').onclick=()=>$('shortcut-dialog').close();
$('shortcut-form').onsubmit=async event=>{event.preventDefault();const name=$('shortcut-name').value.trim(),url=webAddress($('shortcut-url').value);if(!name||!url){$('shortcut-error').textContent='Enter a name and a valid website address.';return;}if(shortcuts.length>=12)return;shortcuts.push({id:crypto.randomUUID(),name,url});try{await save();$('shortcut-dialog').close();message($('status'),'');}catch{shortcuts.pop();$('shortcut-error').textContent='The shortcut could not be saved. Try again.';}};

$('undo-shortcut').onclick=async()=>{if(!removed||shortcuts.length>=12)return;const before=shortcuts;shortcuts=[...shortcuts,removed];try{await save();removed=null;$('undo-shortcut').hidden=true;message($('status'),'Shortcut restored.');}catch{shortcuts=before;render();message($('status'),'The shortcut could not be restored.',true);}};
