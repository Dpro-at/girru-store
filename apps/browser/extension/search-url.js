const web=x=>{try{const u=new URL(x);return typeof x==='string'&&x.length<=4096&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
export function searchAddress(value){
 if(typeof value!=='string'||!value.trim()||value.length>4096)return null;
 const text=value.trim();
 if(/^https?:\/\//i.test(text))return web(text)?text:null;
 if(/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(text))return web('http://'+text)?'http://'+text:null;
 if(/^[a-z][a-z0-9+.-]*:/i.test(text)&&!/^[-\w.]+:\d+(?:\/|$)/.test(text))return null;
 if(/^[-\w.]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(text))return web('https://'+text)?'https://'+text:null;
 return 'https://www.google.com/search?q='+encodeURIComponent(text);
}
