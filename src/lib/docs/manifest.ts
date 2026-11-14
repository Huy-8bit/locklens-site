// Sidebar grouping and stable routes for the documentation.
//
// `source` is a path relative to the LockLens repository root ("repo:") or to
// this site's content/guides directory ("site:"). Article bodies are never
// duplicated here: everything is read from Markdown at build time. Markdown
// files that exist in the repository but are not listed are still published
// under /docs/more/<name>/ so nothing silently disappears.

export interface ManifestEntry {
  source: string;
  slug: string; // '' is not allowed; '/docs/' is the generated docs home
  label?: string;
}

export interface ManifestGroup {
  title: string;
  collapsed?: boolean;
  entries: ManifestEntry[];
}

export const DOCS_MANIFEST: ManifestGroup[] = [
  {
    title: 'Getting started',
    entries: [
      { source: 'repo:docs/quickstart.md', slug: 'getting-started', label: 'Quickstart' },
      { source: 'repo:docs/configuration.md', slug: 'getting-started/configuration', label: 'Configuration' },
      { source: 'repo:docs/ui-design.md', slug: 'getting-started/ui-guide', label: 'UI guide' },
      { source: 'repo:docs/local-lab.md', slug: 'getting-started/local-lab', label: 'Local lab' },
      { source: 'repo:docs/troubleshooting.md', slug: 'getting-started/troubleshooting', label: 'Troubleshooting' },
    ],
  },
  {
    title: 'Architecture',
    entries: [
      { source: 'site:architecture.md', slug: 'architecture', label: 'Architecture overview' },
      { source: 'repo:docs/postgresql-observation.md', slug: 'architecture/postgresql-observation', label: 'PostgreSQL observation & permissions' },
      { source: 'site:production-topology.md', slug: 'architecture/production-topology', label: 'Production topology' },
    ],
  },
  {
    title: 'Features',
    entries: [
      { source: 'repo:docs/blocking-graph.md', slug: 'features/blocking-analysis', label: 'Blocking analysis' },
      { source: 'site:query-analysis.md', slug: 'features/query-analysis', label: 'Query analysis' },
      { source: 'repo:docs/query-intelligence.md', slug: 'features/query-performance', label: 'Query performance intelligence' },
      { source: 'repo:docs/query-optimizer.md', slug: 'features/query-optimizer', label: 'Query optimizer' },
      { source: 'repo:docs/rules.md', slug: 'features/rules', label: 'Rules & findings' },
      { source: 'repo:docs/incidents.md', slug: 'features/incidents', label: 'Incident investigation' },
      { source: 'site:replication-monitoring.md', slug: 'features/replication', label: 'Replication monitoring' },
      { source: 'repo:docs/notifications.md', slug: 'features/notifications', label: 'Notifications' },
      { source: 'repo:docs/investigation-workspace.md', slug: 'features/explorer-and-sql', label: 'Explorer & SQL' },
    ],
  },
  {
    title: 'Deployment & operations',
    entries: [
      { source: 'repo:docs/deployment.md', slug: 'deployment', label: 'Deployment' },
      { source: 'site:high-availability.md', slug: 'deployment/high-availability', label: 'High availability' },
      { source: 'repo:docs/integrations.md', slug: 'deployment/integrations', label: 'Integrations' },
      { source: 'repo:docs/security.md', slug: 'deployment/security', label: 'Security model' },
      { source: 'repo:SECURITY.md', slug: 'deployment/security-policy', label: 'Security policy' },
      { source: 'repo:docs/limitations.md', slug: 'deployment/limitations', label: 'Limitations' },
    ],
  },
  {
    title: 'Reference',
    entries: [
      { source: 'repo:docs/api.md', slug: 'reference/api', label: 'HTTP API' },
      { source: 'repo:docs/cli-reference.md', slug: 'reference/cli', label: 'CLI' },
    ],
  },
];

/** Docs pages that should show an "Explore the interactive architecture" call-out. */
export const INTERACTIVE_LINKS: Record<string, { href: string; label: string }> = {
  architecture: { href: '/architecture/#internal', label: 'Explore the internal architecture interactively' },
  'architecture/production-topology': { href: '/architecture/#production', label: 'Switch between production topologies interactively' },
  'features/blocking-analysis': { href: '/architecture/#incident', label: 'Walk through a blocking incident' },
  'features/incidents': { href: '/architecture/#incident', label: 'Walk through a simulated incident' },
  'features/replication': { href: '/architecture/#production', label: 'See replication paths in a production topology' },
  deployment: { href: '/architecture/#boundaries', label: 'Explore deployment boundaries' },
  'deployment/high-availability': { href: '/architecture/#production', label: 'See the multi-instance lease model' },
  'deployment/security': { href: '/architecture/#boundaries', label: 'Explore security boundaries' },
  'deployment/integrations': { href: '/architecture/#internal', label: 'See where alerts and telemetry leave LockLens' },
};

/**
 * Corrections for heading links that are broken in the upstream Markdown
 * (they are broken on GitHub too). Key: "<repo path>#<fragment as written>".
 * Remove an entry once the upstream file is fixed; `npm run test:links`
 * fails on any unresolved fragment.
 */
export const ANCHOR_ALIASES: Record<string, string> = {
  'docs/configuration.md#administrator': 'users-and-the-environment-administrator',
};
