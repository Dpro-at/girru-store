'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('girruBrowser',{
 onFocusAddress:callback=>{const listener=()=>callback();ipcRenderer.on('browser:focus-address',listener);return ()=>ipcRenderer.removeListener('browser:focus-address',listener);},
 command:body=>ipcRenderer.invoke('browser:command',body),
 onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('browser:state',listener);return ()=>ipcRenderer.removeListener('browser:state',listener);}
});
