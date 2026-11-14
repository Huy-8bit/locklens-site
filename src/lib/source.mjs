// Locates the LockLens repository whose Markdown and screenshots this site publishes.
// Shared by astro.config.mjs (asset sync) and the documentation pipeline.
import { existsSync } from 'node:fs';
import path from 'node:path';

const SITE_ROOT = process.cwd();

function looksLikeRepo(dir) {
  return (
    existsSync(path.join(dir, 'docs', 'architecture.md')) &&
    existsSync(path.join(dir, 'backend')) &&
    existsSync(path.join(dir, 'README.md'))
  );
}

/** Absolute path of the LockLens checkout. */
export function resolveRepoRoot() {
  const fromEnv = process.env.LOCKLENS_REPO;
  if (fromEnv) {
    const dir = path.resolve(SITE_ROOT, fromEnv);
    if (!looksLikeRepo(dir)) {
      throw new Error(
        `LOCKLENS_REPO=${fromEnv} resolves to ${dir}, which does not look like a LockLens checkout (expected docs/architecture.md and backend/).`,
      );
    }
    return dir;
  }
  // 1. The site lives in <repo>/site.  2. The site sits next to a "locklens" checkout.
  for (const candidate of ['..', '../locklens']) {
    const dir = path.resolve(SITE_ROOT, candidate);
    if (looksLikeRepo(dir)) return dir;
  }
  throw new Error(
    'Could not find the LockLens repository. Place this site in <repo>/site, clone the repository to ../locklens, or set LOCKLENS_REPO.',
  );
}

export const REPO_SLUG = 'Huy-8bit/locklens';
export const REPO_URL = `https://github.com/${REPO_SLUG}`;
export const REPO_REF = process.env.LOCKLENS_REPO_REF || 'main';

/** GitHub URL for a repository-relative path (file or directory). */
export function githubUrl(relPath, { edit = false } = {}) {
  const clean = relPath.replace(/^\.?\//, '');
  const isDir = !/\.[a-z0-9]+$/i.test(clean.split('/').pop() ?? '');
  const kind = edit ? 'edit' : isDir ? 'tree' : 'blob';
  return `${REPO_URL}/${kind}/${REPO_REF}/${clean}`;
}
