const config=await(await fetch(chrome.runtime.getURL('config.json'))).json();
document.documentElement.dataset.theme=config.theme||'dark';
export async function api(body){const response=await fetch(config.url+'/ui',{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw Error('This browser action could not be completed.');return response.json();}
export function message(element,text,error=false){element.textContent=text;element.setAttribute('role',error?'alert':'status');}
