// Validates the production build in dist/: every internal link, image, script
// and stylesheet resolves to a file, and every #fragment points at an existing
// id on the target page. External links are counted but not fetched.
// Usage: npm run build && npm run test:links
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.cwd(), 'dist');
const BASE = (process.env.BASE_PATH || '/').replace(/\/$/, '');
if (!existsSync(DIST)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const pages = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) pages.push(p);
  }
};
walk(DIST);

const idCache = new Map();
const idsOf = (file) => {
  if (!idCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(file);
};

const resolveTarget = (urlPath) => {
  let p = decodeURIComponent(urlPath);
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length) || '/';
  const abs = path.join(DIST, p);
  if (p.endsWith('/')) return existsSync(path.join(abs, 'index.html')) ? path.join(abs, 'index.html') : null;
  if (existsSync(abs) && statSync(abs).isFile()) return abs;
  if (existsSync(path.join(abs, 'index.html'))) return path.join(abs, 'index.html');
  return null;
};

const errors = [];
let internal = 0;
let external = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const rel = '/' + path.relative(DIST, page).split(path.sep).join('/');
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  const srcsets = [...html.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0]));
  for (const raw of [...refs, ...srcsets]) {
    const ref = raw.replace(/&amp;/g, '&');
    if (/^(https?:)?\/\//.test(ref)) {
      external++;
      continue;
    }
    if (/^(mailto:|data:|javascript:)/.test(ref)) continue;
    internal++;
    const [pathPart, frag] = ref.split('#');
    const cleanPath = pathPart.split('?')[0];
    let target;
    if (!cleanPath) target = page;
    else if (cleanPath.startsWith('/')) target = resolveTarget(cleanPath);
    else target = resolveTarget(path.posix.join(path.posix.dirname(rel.replace(/index\.html$/, '')), cleanPath));
    if (!target) {
      errors.push(`${rel}: broken link ${ref}`);
      continue;
    }
    if (frag && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(frag))) {
      errors.push(`${rel}: missing anchor #${frag} in ${path.relative(DIST, target)}`);
    }
  }
}

const checks = [
  ['search index', existsSync(path.join(DIST, 'pagefind', 'pagefind.js'))],
  ['sitemap', existsSync(path.join(DIST, 'sitemap-index.xml'))],
  ['robots.txt', existsSync(path.join(DIST, 'robots.txt'))],
  ['404 page', existsSync(path.join(DIST, '404.html'))],
  ['Open Graph image', existsSync(path.join(DIST, 'og.png'))],
];
for (const [name, ok] of checks) if (!ok) errors.push(`missing ${name}`);

console.log(`Checked ${pages.length} pages: ${internal} internal references, ${external} external links (not fetched).`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n` + errors.map((e) => `  ✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log('All internal links, anchors and assets resolve. ✓');
