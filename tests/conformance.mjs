// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse, serialize, editEdgeLabel, defaultEdgeLabel } from '../src/flowpad.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const text = p => readFileSync(p, 'utf8');
const cases = json(join(root, 'cases.json'));
const schema = new Ajv2020({strict: true, allErrors: true}).compile(json(join(root, 'flowpad.schema.json')));
const codecOnly = process.argv.includes('--codec-only');
const tool = process.env.FLOWPAD_CONTRACT_TOOL || resolve(root, '../desktop/build/release/flowpad_contract_tool.exe');
if (!codecOnly) assert(existsSync(tool), 'Build Desktop first (or use --codec-only without claiming cross-runtime validation)');
mkdirSync(join(root, 'results'), {recursive: true});
const output = mkdtempSync(join(root, 'results', 'conformance-'));
const records = [];
function desktop(input, output, args = [], expected = 0) {
  const result = spawnSync(tool, [input, output, ...args], {encoding: 'utf8', timeout: 30000});
  assert.equal(result.error, undefined);
  assert.equal(result.status, expected, `${input}: ${result.stderr}`);
}
for (const name of cases.valid) {
  const input = join(root, 'fixtures', name), golden = json(join(root, 'golden', name));
  assert(schema(json(input)), `${name}: ${JSON.stringify(schema.errors)}`);
  const ts = parse(text(input));
  assert.deepEqual(JSON.parse(serialize(ts)), golden, `TS normalization ${name}`);
  assert.equal(serialize(parse(serialize(ts))), serialize(ts));
  const fromTs = join(output, `ts-${name}`); writeFileSync(fromTs, serialize(ts));
  if (!codecOnly) {
    const fromCpp = join(output, `cpp-${name}`), returnCpp = join(output, `ts-cpp-${name}`);
    desktop(input, fromCpp); assert.deepEqual(json(fromCpp), golden, `C++ normalization ${name}`);
    assert.deepEqual(JSON.parse(serialize(parse(text(fromCpp)))), golden, `C++ -> TS ${name}`);
    desktop(fromTs, returnCpp); assert.deepEqual(json(returnCpp), golden, `TS -> C++ ${name}`);
    if (ts.nodes.length) {
      const id = ts.nodes[0].id, body = 'S8 双向编辑 🧭\n<b>文字</b>';
      const edited = parse(serialize(ts)); edited.nodes.find(n => n.id === id).text = body;
      const expected = JSON.parse(serialize(edited));
      const cppEdit = join(output, `cpp-edit-${name}`);
      desktop(fromTs, cppEdit, ['--edit-node', id, body]);
      assert.deepEqual(JSON.parse(serialize(parse(text(cppEdit)))), expected, `C++ edit preserves extensions ${name}`);
      writeFileSync(fromTs, serialize(edited)); desktop(fromTs, returnCpp);
      assert.deepEqual(json(returnCpp), expected, `TS edit preserves extensions ${name}`);
    }
  }
  records.push({file:name, accepted:true, desktopTested:!codecOnly, passed:true});
}
for (const {file} of cases.invalid) {
  const input=join(root,'invalid',file);
  assert.throws(()=>parse(text(input)), undefined, file);
  const target=join(output,`rejected-${file}`); writeFileSync(target,'preserve existing output');
  if (!codecOnly) desktop(input,target,[],2);
  assert.equal(text(target),'preserve existing output');
  records.push({file,accepted:false,desktopTested:!codecOnly,passed:true});
}
const auto=parse(text(join(root,'fixtures/v1_auto_labels.flowpad')));
const label=auto.edges.find(e=>e.autoLabel);
const changed=editEdgeLabel(auto,label.id,'是');
assert(!Object.hasOwn(changed.edges.find(e=>e.id===label.id),'autoLabel'));
assert(auto.edges.find(e=>e.id===label.id).autoLabel, 'Original document must remain unchanged');
assert.equal(defaultEdgeLabel('question','right'),'是'); assert.equal(defaultEdgeLabel('repeat','bottom'),'完成');
assert.equal(defaultEdgeLabel('note','right'),'');
assert.equal(Object.prototype.safe,undefined,'Prototype keys are data');
for (const opaque of ['9007199254740993','1e999','"\\ud800"']) {
  const base=text(join(root,'fixtures/v1_empty.flowpad')).trim();
  assert.throws(()=>parse(base.slice(0,-1)+',"future":'+opaque+'}'));
}
assert.throws(()=>parse(' '.repeat(32*1024*1024+1)), /file-size/);
const empty=text(join(root,'fixtures/v1_empty.flowpad')).trim();
assert.throws(()=>parse(empty.slice(0,-1)+',"deep":'+'['.repeat(256)+'0'+']'.repeat(256)+'}'), /interchange-depth/);
const manifest=json(join(root,'manifest.json'));
for (const [name,hash] of Object.entries(manifest.files))
  assert.equal(createHash('sha256').update(readFileSync(join(root,name))).digest('hex'),hash,`Frozen contract changed: ${name}`);
assert.equal(text(join(root,'flowpad.schema.json')),text(resolve(root,'../desktop/schema/flowpad.schema.json')),'Desktop schema mirror drift');
const report={passed:true,contractRevision:manifest.contractRevision,node:process.version,desktopTested:!codecOnly,
  desktopTool:codecOnly?null:tool,valid:cases.valid.length,invalid:cases.invalid.length,records,artifacts:output,
  scope:'Codec/schema conformance. This is not a VS Code Extension Host or TextDocument integration test.'};
writeFileSync(join(root,'results/latest-conformance.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,valid:cases.valid.length,invalid:cases.invalid.length,desktopTested:!codecOnly,output},null,2));
