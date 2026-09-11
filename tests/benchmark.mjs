// SPDX-License-Identifier: GPL-3.0-only
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {parse,serialize} from '../src/flowpad.ts';
const root=new URL('../',import.meta.url);
const input=readFileSync(new URL('fixtures/v1_large.flowpad',root),'utf8');
const doc=parse(input);
const measure=fn=>{ for(let i=0;i<3;i++)fn(); const times=[]; for(let i=0;i<15;i++){const start=performance.now();fn();times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {medianMs:times[7],p95Ms:times[14],samples:15}; };
const report={node:process.version,nodes:doc.nodes.length,edges:doc.edges.length,bytes:Buffer.byteLength(input),parse:measure(()=>parse(input)),serialize:measure(()=>serialize(doc)),method:'Node binary64 codec; 3 warmups; 15 samples; parse includes validation, serialize includes revalidation. Not an extension activation or renderer measurement.'};
mkdirSync(new URL('results/',root),{recursive:true});writeFileSync(new URL('results/benchmark.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
