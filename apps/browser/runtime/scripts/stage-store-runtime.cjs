'use strict';
/** Stage existing compiled Browser files for a reviewed Store archive. Never builds or downloads. */
const fs=require('node:fs'),path=require('node:path');
function stage({source,native,out,version,platform=process.platform+'-'+process.arch}){
 source=fs.realpathSync(source);native=fs.realpathSync(native);out=path.resolve(out);
 if(!/^\d{1,6}\.\d{1,6}\.\d{1,6}(?:-[0-9A-Za-z.-]{1,40})?$/.test(version)||!['darwin-arm64','darwin-x64','linux-x64','win32-x64'].includes(platform))throw Error('Explicit supported platform and version required');
 for(const root of [source,native])if(out===root||out.startsWith(root+path.sep))throw Error('Output must be outside source and native inputs');
 if(fs.existsSync(out))throw Error('Output already exists; choose a new staging folder');
 const pkg=JSON.parse(fs.readFileSync(path.join(source,'runtime/package.json'),'utf8'));if(pkg.name!=='@girru/browser')throw Error('Not the Browser runtime');
 const executable=platform.startsWith('darwin-')?'Contents/MacOS/GirruBrowser':platform==='win32-x64'?'GirruBrowser.exe':'girru-browser';if(!fs.statSync(path.join(native,executable)).isFile())throw Error('Existing native executable missing');
 let files=0,bytes=0;
 function copy(from,to,allowed,parents=new Set()){
  const real=fs.realpathSync(from);if(real!==allowed&&!real.startsWith(allowed+path.sep))throw Error('Input link leaves its reviewed source tree');if(parents.has(real))throw Error('Input contains a link cycle');
  const stat=fs.statSync(real);if(stat.isDirectory()){const next=new Set(parents);next.add(real);fs.mkdirSync(to,{recursive:true,mode:0o755});for(const name of fs.readdirSync(real).sort())copy(path.join(real,name),path.join(to,name),allowed,next);return;}
  if(!stat.isFile()||++files>400000||(bytes+=stat.size)>8*1024**3)throw Error('Runtime input exceeds bounds or contains special files');
  fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(real,to,fs.constants.COPYFILE_FICLONE);fs.chmodSync(to,stat.mode&0o111?0o755:0o644);
 }
 try{
  for(const part of ['runtime/package.json','runtime/scripts','runtime/src','runtime/node_modules','extension'])copy(path.join(source,part),path.join(out,part),source);
  copy(native,path.join(out,'native',platform.startsWith('darwin-')?'GirruBrowser.app':''),native);
  fs.writeFileSync(path.join(out,'browser-runtime.json'),JSON.stringify({protocolVersion:1,version,platform})+'\n');
  return{out,files,bytes,version,platform};
 }catch(error){fs.rmSync(out,{recursive:true,force:true});throw error;}
}
module.exports={stage};
if(require.main===module){try{
 const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){if(!['--source','--native','--out','--version','--platform'].includes(args[i])||!args[i+1])throw Error('Expected --source --native --out --version [--platform]');options[args[i].slice(2)]=args[i+1];}
 console.log(JSON.stringify(stage(options)));
}catch(error){console.error(error.message);process.exitCode=1;}}
