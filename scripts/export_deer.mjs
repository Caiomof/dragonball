// Reproducible original model export. Run with Node >=22.18 (type stripping).
import {writeFileSync} from 'node:fs';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createDeer} from '../src/world/DeerAsset.ts';
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});} readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}};
const {scene,animations}=createDeer();
const data=await new GLTFExporter().parseAsync(scene,{binary:true,animations});
writeFileSync(new URL('../public/models/wildlife/deer.glb',import.meta.url),Buffer.from(data));
console.log('Exported original deer with six animation clips.');
