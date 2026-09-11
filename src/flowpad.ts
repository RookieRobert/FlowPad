// SPDX-License-Identifier: GPL-3.0-only
/** Toolkit-independent v1 codec. Does not read files, render, or modify a TextDocument. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Fields = { [key: string]: Json };
export const nodeTypes = ['goalStart', 'step', 'question', 'repeat', 'info', 'result', 'note'] as const;
export type NodeType = typeof nodeTypes[number];
export const ports = ['left', 'top', 'right', 'bottom'] as const;
export type Port = typeof ports[number];
export interface FlowNode extends Fields {
  id: string; type: NodeType; x: number; y: number; width: number; height: number; text: string;
}
export interface Endpoint extends Fields { nodeId: string; port: Port }
export interface FlowEdge extends Fields { id: string; source: Endpoint; target: Endpoint; label: string }
export interface FlowDocument extends Fields {
  format: 'flowpad'; schemaVersion: 1;
  document: Fields & { id: string; title: string };
  canvas: Fields & { zoom: number; center: Fields & { x: number; y: number } };
  nodes: FlowNode[]; edges: FlowEdge[];
}
export class ContractError extends Error {
  code: string; path: string;
  constructor(code: string, path: string) { super(`${code}: ${path}`); this.code = code; this.path = path; }
}
const fail = (code: string, path: string): never => { throw new ContractError(code, path); };
const own = (o: Fields, key: string) => Object.prototype.hasOwnProperty.call(o, key);
function object(v: Json, path: string): Fields {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return fail('object', path);
  return v;
}
function string(v: Json, path: string, nonempty = false): string {
  if (typeof v !== 'string' || (nonempty && !v.length)) return fail('string', path);
  return v;
}
function number(v: Json, path: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return fail('number', path);
  return v;
}
function endpoint(v: Json, fallback: Port, path: string): Endpoint {
  const e = object(v, path);
  const port = own(e, 'port') ? string(e.port, path + '.port') : fallback;
  if (!(ports as readonly string[]).includes(port)) return fail('port', path);
  return { ...e, nodeId: string(e.nodeId, path + '.nodeId', true), port: port as Port };
}
/** Rejects invalid input before returning a new independent normalized object. */
export function parse(text: string): FlowDocument {
  if (new TextEncoder().encode(text).length > 32 * 1024 * 1024) return fail('file-size', '$');
  let parsed: Json;
  try { parsed = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as Json; }
  catch { return fail('json', '$'); }
  // JSON.parse cannot preserve integers outside binary64's exact integer range.
  // Refuse that interoperability envelope rather than silently save changed metadata.
  const pending: {value: Json; depth: number}[] = [{value: parsed, depth: 1}];
  while (pending.length) {
    const {value, depth} = pending.pop()!;
    if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER))
      return fail('interchange-number', '$');
    if (typeof value === 'string' && /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))
      return fail('interchange-unicode', '$');
    if (value && typeof value === 'object') {
      if (depth > 256) return fail('interchange-depth', '$');
      for (const [key, child] of Object.entries(value)) {
        pending.push({value: key, depth}, {value: child, depth: depth + 1});
      }
    }
  }
  const root = object(parsed, '$');
  if (root.format !== 'flowpad') return fail('format', '$.format');
  if (root.schemaVersion !== 1) return fail('version', '$.schemaVersion');
  const doc = object(root.document, '$.document'), camera = object(root.canvas, '$.canvas');
  const center = own(camera, 'center') ? object(camera.center, '$.canvas.center') : { x: 0, y: 0 };
  const zoom = own(camera, 'zoom') ? number(camera.zoom, '$.canvas.zoom', Number.MIN_VALUE, Number.MAX_VALUE) : 1;
  if (!Array.isArray(root.nodes) || !Array.isArray(root.edges)) return fail('array', '$');
  if (root.nodes.length > 100000 || root.edges.length > 200000) return fail('count', '$');
  const byId = new Map<string, FlowNode>();
  const nodes = root.nodes.map((value, i) => {
    const path = `$.nodes[${i}]`, n = object(value, path);
    const id = string(n.id, path + '.id', true), type = string(n.type, path + '.type');
    if (byId.has(id)) return fail('duplicate-node', path);
    if (!(nodeTypes as readonly string[]).includes(type)) return fail('node-type', path);
    const node: FlowNode = { ...n, id, type: type as NodeType,
      x: number(n.x, path + '.x', -1000000, 1000000), y: number(n.y, path + '.y', -1000000, 1000000),
      width: own(n, 'width') ? number(n.width, path + '.width', Number.MIN_VALUE, 100000) : 240,
      height: own(n, 'height') ? number(n.height, path + '.height', Number.MIN_VALUE, 100000) : 104,
      text: string(n.text, path + '.text') };
    byId.set(id, node); return node;
  });
  const edgeIds = new Set<string>(), connections = new Set<string>();
  const edges = root.edges.map((value, i) => {
    const path = `$.edges[${i}]`, e = object(value, path), id = string(e.id, path + '.id', true);
    const source = endpoint(e.source, 'right', path + '.source'), target = endpoint(e.target, 'left', path + '.target');
    const from = byId.get(source.nodeId), to = byId.get(target.nodeId);
    if (!from || !to || from.type === 'note' || to.type === 'note') return fail('endpoint', path);
    if (source.nodeId === target.nodeId && source.port === target.port) return fail('self-port', path);
    const key = JSON.stringify([source.nodeId, source.port, target.nodeId, target.port]);
    if (connections.has(key) || edgeIds.has(id)) return fail('duplicate-edge', path);
    if (own(e, 'autoLabel') && typeof e.autoLabel !== 'boolean') return fail('auto-label', path);
    connections.add(key); edgeIds.add(id);
    const edge: FlowEdge = { ...e, id, source, target, label: own(e, 'label') ? string(e.label, path + '.label') : '', route: [] };
    if (e.autoLabel !== true) delete edge.autoLabel;
    return edge;
  });
  return { ...root, format: 'flowpad', schemaVersion: 1,
    document: { ...doc, id: string(doc.id, '$.document.id', true), title: own(doc, 'title') ? string(doc.title, '$.document.title') : '未命名' },
    canvas: { ...camera, zoom, center: { ...center,
      x: number(center.x, '$.canvas.center.x', -1000000, 1000000), y: number(center.y, '$.canvas.center.y', -1000000, 1000000) } },
    nodes, edges };
}
/** Whitespace/object-key order is not a contract; stable IDs and JSON values are. */
export function serialize(document: FlowDocument): string {
  const normalized = parse(JSON.stringify(document));
  const byId = (a: {id: string}, b: {id: string}) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  normalized.nodes.sort(byId); normalized.edges.sort(byId);
  return JSON.stringify(normalized, null, 2) + '\n';
}
export function editEdgeLabel(document: FlowDocument, id: string, text: string): FlowDocument {
  const next = parse(serialize(document)), edge = next.edges.find(e => e.id === id);
  if (!edge) return fail('missing-edge', id);
  edge.label = text; delete edge.autoLabel; return next;
}
export function defaultEdgeLabel(type: NodeType, port: Port): string {
  if (type === 'question') return port === 'right' ? '是' : port === 'bottom' ? '否' : '';
  if (type === 'repeat') return port === 'right' ? '继续' : port === 'bottom' ? '完成' : '';
  return '';
}
