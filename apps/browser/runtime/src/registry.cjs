'use strict';
const {randomUUID,randomBytes}=require('node:crypto');
const {EventEmitter}=require('node:events');
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
function webUrl(value){const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>4096)throw Error('Choose an http or https address.');return url.href;}
/** Runtime identities are issued by the owner connection, never by an agent request. */
class Registry extends EventEmitter{
 constructor(){super();this.agents=new Map();this.tabs=new Map();this.active=null;this.queues=new Map();this.register({id:'owner',name:'You',department:''});}
 register({id,name,department='',workspaceId=''}){if(!validId(id)||typeof name!=='string'||!name.trim()||name.length>80||typeof department!=='string'||department.length>80||typeof workspaceId!=='string'||(workspaceId!==''&&(!validId(workspaceId)||workspaceId==='owner')))throw Error('Invalid agent identity.');if(this.agents.has(id))return this.agents.get(id);if(this.agents.size>=5001)throw Error('Agent limit reached.');const agent={id,name,department,workspaceId:typeof workspaceId==='string'?workspaceId.slice(0,160):'',token:randomBytes(32).toString('hex')};this.agents.set(id,agent);this.changed();return agent;}
 authenticate(token){return [...this.agents.values()].find(a=>a.id!=='owner'&&a.token===token);}
 agent(id){const a=this.agents.get(id);if(!a)throw Error('Unknown agent.');return a;}
 own(agentId,tabId){this.agent(agentId);const tab=this.tabs.get(tabId);if(!tab||tab.agentId!==agentId)throw Error('This tab belongs to another participant.');return tab;}
 add(agentId){this.agent(agentId);if(this.tabs.size>=48||[...this.tabs.values()].filter(t=>t.agentId===agentId).length>=8)throw Error('Close an unused tab before opening another.');const tab={id:randomUUID(),agentId,title:'New tab',url:'',busy:false};this.tabs.set(tab.id,tab);if(!this.active)this.active=tab.id;this.changed();return tab;}
 remove(agentId,id){this.own(agentId,id);this.tabs.delete(id);if(this.active===id)this.active=this.tabs.keys().next().value??null;this.changed();}
 changed(){this.emit('change');}
 snapshot(){return {active:this.active,agents:[...this.agents.values()].map(({token,...a})=>a),tabs:[...this.tabs.values()].map(({page,view,...t})=>t)};}
 serial(id,work){this.agent(id);const previous=this.queues.get(id)||Promise.resolve();const next=previous.catch(()=>{}).then(work);this.queues.set(id,next);void next.finally(()=>{if(this.queues.get(id)===next)this.queues.delete(id);}).catch(()=>{});return next;}
}
module.exports={Registry,webUrl};
