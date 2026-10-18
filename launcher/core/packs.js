const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const inst = require('./instances');

// Resource pack format per Minecraft release, used when the game jar isn't downloaded yet.
const TABLE = [
  ['1.8', 1], ['1.9', 2], ['1.11', 3], ['1.13', 4], ['1.15', 5], ['1.16.2', 6], ['1.17', 7], ['1.18', 8],
  ['1.19', 9], ['1.19.3', 12], ['1.19.4', 13], ['1.20', 15], ['1.20.2', 18], ['1.20.3', 22], ['1.20.5', 32],
  ['1.21', 34], ['1.21.2', 42], ['1.21.4', 46], ['1.21.5', 55], ['1.21.6', 63], ['1.21.7', 64],
  ['1.21.9', 69], ['1.21.11', 75],
];
const NEW_FORMAT_FROM = 65; // pack.mcmeta gained min_format / max_format here

function ver(v) { return String(v).split('.').map(n => parseInt(n, 10) || 0); }
function cmp(a, b) {
  const x = ver(a), y = ver(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
}

function tableFormat(mc) {
  let best = null;
  for (const [v, f] of TABLE) if (cmp(mc, v) >= 0) best = f;
  return best;
}

/** The resource pack format a Minecraft version expects: read from the game jar when present, else a table. */
function formatFor(mc) {
  const versions = path.join(inst.SHARED, 'versions');
  const jars = [path.join(versions, mc, mc + '.jar')];
  try {
    for (const d of fs.readdirSync(versions)) {
      if (d.endsWith('-' + mc)) jars.push(path.join(versions, d, d + '.jar'));
    }
  } catch { /* nothing downloaded yet */ }
  for (const jar of jars) {
    try {
      if (!fs.existsSync(jar)) continue;
      const e = new AdmZip(jar).getEntry('version.json');
      if (!e) continue;
      const pv = JSON.parse(e.getData().toString('utf8')).pack_version;
      const f = pv && (pv.resource_major ?? pv.resource);
      if (Number.isFinite(f)) return f;
    } catch { /* fall through */ }
  }
  return tableFormat(mc);
}

// ---- pack.mcmeta helpers

const major = (v) => Array.isArray(v) ? Number(v[0]) : Number(v);

function readMeta(file) {
  try {
    if (fs.statSync(file).isDirectory()) {
      const p = path.join(file, 'pack.mcmeta');
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')) : null;
    }
    const e = new AdmZip(file).getEntry('pack.mcmeta');
    return e ? JSON.parse(e.getData().toString('utf8').replace(/^﻿/, '')) : null;
  } catch { return null; }
}

/** [min, max] formats a pack declares, or null if unreadable. */
function range(meta) {
  const p = meta && meta.pack;
  if (!p) return null;
  let min = Number.isFinite(p.pack_format) ? p.pack_format : null;
  let max = min;
  const sf = p.supported_formats;
  if (Array.isArray(sf) && sf.length >= 2) { min = Math.min(min ?? sf[0], sf[0]); max = Math.max(max ?? sf[1], sf[1]); }
  else if (sf && typeof sf === 'object') {
    if (Number.isFinite(sf.min_inclusive)) min = Math.min(min ?? sf.min_inclusive, sf.min_inclusive);
    if (Number.isFinite(sf.max_inclusive)) max = Math.max(max ?? sf.max_inclusive, sf.max_inclusive);
  } else if (Number.isFinite(sf)) { min = Math.min(min ?? sf, sf); max = Math.max(max ?? sf, sf); }
  if (p.min_format !== undefined) min = major(p.min_format);
  if (p.max_format !== undefined) max = major(p.max_format);
  return min === null ? null : [min, max ?? min];
}

// ---- options.txt (which packs are switched on)

function optionsPath(i) { return path.join(inst.dirOf(i), 'options.txt'); }

function readEnabled(i) {
  try {
    const m = /^resourcePacks:(\[.*\])\s*$/m.exec(fs.readFileSync(optionsPath(i), 'utf8'));
    return m ? JSON.parse(m[1]) : [];
  } catch { return []; }
}

function writeEnabled(i, list) {
  const p = optionsPath(i);
  const line = 'resourcePacks:' + JSON.stringify(list);
  let txt = '';
  try { txt = fs.readFileSync(p, 'utf8'); } catch { /* new file */ }
  if (/^resourcePacks:.*$/m.test(txt)) txt = txt.replace(/^resourcePacks:.*$/m, line);
  else txt = (txt && !txt.endsWith('\n') ? txt + '\n' : txt) + line + '\n';
  fs.writeFileSync(p, txt);
}

// ---- public API

function dirFor(i, kind) { return path.join(inst.dirOf(i), kind === 'shader' ? 'shaderpacks' : 'resourcepacks'); }

function safe(i, kind, name) {
  const base = path.basename(name);
  if (base !== name) throw new Error('Bad file name');
  return path.join(dirFor(i, kind), base);
}

function list(instanceId, kind = 'resourcepack') {
  const i = inst.find(instanceId);
  if (!i) return [];
  const dir = dirFor(i, kind);
  if (!fs.existsSync(dir)) return [];
  const target = formatFor(i.mc);
  const on = kind === 'resourcepack' ? readEnabled(i) : [];
  return fs.readdirSync(dir).filter(n => !n.startsWith('.')).map(name => {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    const isDir = st.isDirectory();
    if (!isDir && !/\.zip$/i.test(name)) return null;
    const out = { name, size: isDir ? 0 : st.size, dir: isDir };
    if (kind === 'resourcepack') {
      const r = range(readMeta(full));
      out.formats = r;
      out.valid = !!r;
      out.compatible = !!r && target !== null && target >= r[0] && target <= r[1];
      out.enabled = on.includes('file/' + name);
    }
    return out;
  }).filter(Boolean);
}

/** Rewrites pack.mcmeta so the pack declares support for this instance's Minecraft version. */
function convert(instanceId, name) {
  const i = inst.find(instanceId);
  if (!i) throw new Error('Unknown instance');
  const target = formatFor(i.mc);
  if (target === null) throw new Error(`Don't know the pack format for ${i.mc}. Launch it once first.`);
  const full = safe(i, 'resourcepack', name);
  const meta = readMeta(full);
  if (!meta || !meta.pack) throw new Error('Not a resource pack (no pack.mcmeta)');
  const p = meta.pack;
  const r = range(meta) || [target, target];
  const min = Math.min(r[0], target), max = Math.max(r[1], target);
  p.pack_format = target;
  p.supported_formats = { min_inclusive: min, max_inclusive: max };
  if (target >= NEW_FORMAT_FROM || p.min_format !== undefined) { p.min_format = min; p.max_format = max; }
  const json = Buffer.from(JSON.stringify(meta, null, 2), 'utf8');
  if (fs.statSync(full).isDirectory()) {
    fs.writeFileSync(path.join(full, 'pack.mcmeta'), json);
  } else {
    const z = new AdmZip(full);
    z.getEntry('pack.mcmeta') ? z.updateFile('pack.mcmeta', json) : z.addFile('pack.mcmeta', json);
    const tmp = full + '.tmp';
    z.writeZip(tmp);
    fs.renameSync(tmp, full);
  }
  return { name, from: r, to: target };
}

/** Converts every pack that doesn't already cover the instance's version. Returns what changed. */
function convertAll(instanceId) {
  const done = [], failed = [];
  for (const p of list(instanceId)) {
    if (p.valid && !p.compatible) {
      try { done.push(convert(instanceId, p.name)); } catch (e) { failed.push({ name: p.name, error: e.message }); }
    }
  }
  return { converted: done, failed };
}

function toggle(instanceId, name) {
  const i = inst.find(instanceId);
  safe(i, 'resourcepack', name);
  const cur = readEnabled(i);
  const key = 'file/' + name;
  let next;
  if (cur.includes(key)) next = cur.filter(x => x !== key);
  else next = [...(cur.length ? cur : ['vanilla']), key];
  writeEnabled(i, next);
  return list(instanceId);
}

function remove(instanceId, name, kind = 'resourcepack') {
  const i = inst.find(instanceId);
  const full = safe(i, kind, name);
  fs.rmSync(full, { recursive: true, force: true });
  if (kind === 'resourcepack') writeEnabled(i, readEnabled(i).filter(x => x !== 'file/' + name));
  return list(instanceId, kind);
}

module.exports = { formatFor, list, convert, convertAll, toggle, remove, dirFor };
