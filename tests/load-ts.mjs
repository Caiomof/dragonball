import {build} from 'esbuild';
const cache=new Map();
export async function load(path){
 if(!cache.has(path)){cache.set(path,(async()=>{const r=await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));})());}
 return cache.get(path);
}
