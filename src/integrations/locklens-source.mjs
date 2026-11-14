// Astro integration: mirrors the repository's documentation images into
// src/generated/repo-images so Astro's image pipeline can optimise them, and
// reloads the dev server when repository Markdown changes. In dev it also
// builds a Pagefind search index from the dev server's own docs pages, so
// search works without a production build.
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRepoRoot } from '../lib/source.mjs';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

function syncImages(repoRoot, outDir, logger) {
  const srcDir = path.join(repoRoot, 'docs', 'images');
  mkdirSync(outDir, { recursive: true });
  if (!existsSync(srcDir)) return 0;
  let copied = 0;
  for (const name of readdirSync(srcDir)) {
    if (!IMAGE_EXT.test(name)) continue;
    const from = path.join(srcDir, name);
    const to = path.join(outDir, name);
    if (existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) continue;
    copyFileSync(from, to);
    copied++;
  }
  if (copied) logger.info(`synced ${copied} documentation image(s) from ${srcDir}`);
  return copied;
}

const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm' };

/**
 * Dev only: crawl /docs/ on the running dev server and write a Pagefind index
 * to .astro/pagefind-dev/, which the dev server serves at <base>/pagefind/.
 * public/ is never touched, so production builds are unaffected.
 */
async function buildDevSearchIndex(origin, base, indexDir, logger) {
  const { createIndex, close } = await import('pagefind');
  const prefix = base.replace(/\/$/, '');
  const home = await fetch(`${origin}${prefix}/docs/`).then((r) => r.text());
  const paths = [...new Set([...home.matchAll(/href="([^"#?]+)"/g)].map((m) => m[1]).filter((h) => h.startsWith(`${prefix}/docs/`) && h !== `${prefix}/docs/`))];
  const { index } = await createIndex();
  let added = 0;
  for (const p of paths) {
    const res = await fetch(origin + p);
    if (!res.ok) continue;
    // Index URLs without the base path; the search UI adds it back (baseUrl option), as in production.
    await index.addHTMLFile({ url: p.slice(prefix.length) || '/', content: await res.text() });
    added++;
  }
  await index.writeFiles({ outputPath: indexDir });
  await close();
  logger.info(`dev search index: ${added} docs page(s) indexed`);
}

export function locklensSource() {
  return {
    name: 'locklens-source',
    hooks: {
      'astro:config:setup': ({ config, logger, updateConfig, command }) => {
        const repoRoot = resolveRepoRoot();
        const outDir = path.join(fileURLToPath(config.srcDir), 'generated', 'repo-images');
        logger.info(`documentation source: ${repoRoot}`);
        syncImages(repoRoot, outDir, logger);

        if (command !== 'dev') return;
        const watched = [path.join(repoRoot, 'docs'), path.join(repoRoot, 'CONTRIBUTING.md'), path.join(repoRoot, 'SECURITY.md')];
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'locklens-docs-watch',
                configureServer(server) {
                  const indexDir = path.join(fileURLToPath(config.root), '.astro', 'pagefind-dev');
                  const route = `${config.base.replace(/\/$/, '')}/pagefind/`;
                  server.middlewares.use((req, res, next) => {
                    const url = (req.url ?? '').split('?')[0];
                    if (!url.startsWith(route)) return next();
                    const file = path.join(indexDir, url.slice(route.length));
                    if (!file.startsWith(indexDir) || !existsSync(file) || !statSync(file).isFile()) return next();
                    res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
                    res.setHeader('Cache-Control', 'no-store');
                    createReadStream(file).pipe(res);
                  });
                  let timer;
                  let running = false;
                  const scheduleIndex = (delay) => {
                    clearTimeout(timer);
                    timer = setTimeout(async () => {
                      const origin = server.resolvedUrls?.local?.[0]?.replace(/\/$/, '').replace(new RegExp(`${config.base.replace(/\/$/, '')}$`), '');
                      if (!origin || running) return scheduleIndex(2000);
                      running = true;
                      try {
                        await buildDevSearchIndex(origin, config.base, indexDir, logger);
                      } catch (err) {
                        logger.warn(`dev search index failed: ${err.message}`);
                      } finally {
                        running = false;
                      }
                    }, delay);
                  };
                  server.httpServer?.once('listening', () => scheduleIndex(1500));
                  server.watcher.add(watched);
                  server.watcher.on('all', (_event, file) => {
                    const inRepo = file.startsWith(repoRoot);
                    const siteGuide = file.includes(`${path.sep}content${path.sep}guides${path.sep}`);
                    if (!inRepo && !siteGuide) return;
                    if (inRepo && IMAGE_EXT.test(file)) syncImages(repoRoot, outDir, logger);
                    if (/\.(md|png|jpe?g|webp|gif|svg)$/i.test(file)) {
                      server.ws.send({ type: 'full-reload' });
                      if (file.endsWith('.md')) scheduleIndex(1500);
                    }
                  });
                },
              },
            ],
          },
        });
      },
    },
  };
}
