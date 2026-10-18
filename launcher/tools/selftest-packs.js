// node tools/selftest-packs.js  (uses a throwaway data dir)
const fs = require('fs');
const path = require('path');
process.env.SQUISHY_HOME = path.join(__dirname, '..', '..', '_selftest_' + Date.now());
const AdmZip = require('adm-zip');
const inst = require('../core/instances');
const packs = require('../core/packs');
const mr = require('../core/modrinth');

(async () => {
  const i = inst.create({ name: 'T', mc: '1.21.11', loader: 'fabric' });
  const dir = packs.dirFor(i, 'resourcepack');
  fs.mkdirSync(dir, { recursive: true });

  // synthetic old pack (format 15 = 1.20) as a zip and as a folder
  const z = new AdmZip();
  z.addFile('pack.mcmeta', Buffer.from(JSON.stringify({ pack: { pack_format: 15, description: 'old' } })));
  z.writeZip(path.join(dir, 'old.zip'));
  fs.mkdirSync(path.join(dir, 'oldfolder'));
  fs.writeFileSync(path.join(dir, 'oldfolder', 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: 9 } }));

  const show = (t) => console.log(t, JSON.stringify(packs.list(i.id).map(p => [p.name, p.formats, p.compatible, p.enabled])));
  show('before');
  console.log('convertAll', JSON.stringify(packs.convertAll(i.id)));
  show('after ');
  packs.toggle(i.id, 'old.zip');
  console.log('options.txt:', fs.readFileSync(path.join(inst.dirOf(i), 'options.txt'), 'utf8').trim());
  show('toggled');

  // real Modrinth download of a resource pack + shader
  const r = await mr.search({ query: 'faithful', projectType: 'resourcepack', gameVersion: '1.21.11', limit: 3 });
  console.log('search hits', r.hits.map(h => h.title).join(', '));
  const got = await mr.installPack(r.hits[0].id, { gameVersion: '1.21.11', destDir: dir });
  console.log('installed', got);
  try { packs.convert(i.id, got.file); } catch (e) { console.log('convert err', e.message); }
  show('final ');

  const s = await mr.search({ query: 'complementary', projectType: 'shader', gameVersion: '1.21.11', limit: 2 });
  console.log('shader hits', s.hits.map(h => h.title).join(', '));
  fs.rmSync(process.env.SQUISHY_HOME, { recursive: true, force: true });
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
