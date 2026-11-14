// Astro integration: mirrors the repository's documentation images into
// src/generated/repo-images so Astro's image pipeline can optimise them, and
// reloads the dev server when repository Markdown changes.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
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
                  server.watcher.add(watched);
                  server.watcher.on('all', (_event, file) => {
                    if (!file.startsWith(repoRoot)) return;
                    if (IMAGE_EXT.test(file)) syncImages(repoRoot, outDir, logger);
                    if (/\.(md|png|jpe?g|webp|gif|svg)$/i.test(file)) server.ws.send({ type: 'full-reload' });
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
