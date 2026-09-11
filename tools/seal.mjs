// SPDX-License-Identifier: GPL-3.0-only
// Explicit maintenance action after contract review; tests never update the seal.
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
if(!process.argv.includes('--reviewed')) throw new Error('Review FORMAT/schema/fixtures/client impact first; then pass --reviewed');
const root=fileURLToPath(new URL('../',import.meta.url)),files={};
function visit(path){for(const entry of readdirSync(path,{withFileTypes:true})){const p=join(path,entry.name);if(entry.isDirectory())visit(p);else add(p);}}
function add(p){files[relative(root,p).replaceAll('\\','/')]=createHash('sha256').update(readFileSync(p)).digest('hex');}
for(const name of ['LICENSE','flowpad.schema.json','cases.json','FORMAT.md','REFERENCE_BEHAVIOR.md','COMPATIBILITY_MATRIX.md',
  'README.md','package.json','package-lock.json','tsconfig.json'])add(join(root,name));
for(const name of ['fixtures','golden','invalid','src','reference','tests','tools'])visit(join(root,name));
writeFileSync(join(root,'manifest.json'),JSON.stringify({contractRevision:'1.0.0',schemaVersion:1,files:Object.fromEntries(Object.entries(files).sort())},null,2)+'\n');
