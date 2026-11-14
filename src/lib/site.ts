import { REPO_URL } from './source.mjs';

export const SITE = {
  name: 'LockLens',
  tagline: 'The new lens for PostgreSQL monitoring',
  description:
    'LockLens is open-source incident investigation for PostgreSQL: it names the root blocker of a blocking chain, flags statements that got slower than their own baseline, and keeps the evidence of every incident. Self-hosted and MIT licensed.',
  repo: REPO_URL,
  issues: `${REPO_URL}/issues`,
  releases: `${REPO_URL}/releases`,
  license: 'MIT',
  dockerBackend: 'https://hub.docker.com/r/johnnynguyen882/locklens-backend',
  dockerFrontend: 'https://hub.docker.com/r/johnnynguyen882/locklens-frontend',
};

/** Prefix an absolute site path with the configured base path. */
export function url(p: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  if (/^(https?:|mailto:|#)/.test(p)) return p;
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}

export const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Architecture', href: '/architecture/' },
  { label: 'Interactive demo', href: '/#incident-demo' },
  { label: 'Documentation', href: '/docs/' },
];
