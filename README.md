# LockLens website

The official LockLens website: landing page, interactive architecture explorer, and documentation. It is a static site (Astro + React islands) that runs independently of the LockLens monitoring backend — no database or live LockLens instance is needed to build or serve it.

| Route | What it is |
| --- | --- |
| `/` | Landing page: hero animation, product screenshots, feature storytelling, architecture preview, production topology, incident simulation, quick start |
| `/architecture/` | Architecture explorer: collection schedule, internal component explorer, production topologies (single instance, cluster, fleet, multi-instance), data flows, incident walkthrough, deployment boundaries, security |
| `/docs/` | Documentation home |
| `/docs/<section>/<page>/` | Every Markdown file of the LockLens repository's `docs/` (plus `CONTRIBUTING.md`, `SECURITY.md` and three site guides), rendered at build time |
| `/404` | Not-found page (configure your host to serve `404.html`) |

## Requirements

- Node.js ≥ 22.23.4 (Astro 7) and npm
- A checkout of the [LockLens repository](https://github.com/Huy-8bit/locklens). The site looks for it, in order, at `$LOCKLENS_REPO`, at `..` (when this site lives in `<repo>/site`), at `../locklens`, and at `../../locklens`.

## Commands

```sh
npm ci
npm run dev          # http://localhost:4321 — Markdown and screenshot changes in the repo reload the page
npm run build        # static site in dist/, then the Pagefind search index in dist/pagefind/
npm run preview      # serve dist/ locally (search works here, not in dev)

npm run check        # astro check (TypeScript + Astro diagnostics)
npm run lint         # ESLint, zero warnings allowed
npm run test:links   # every internal link, #anchor, image, script and stylesheet in dist/ resolves
npm run test:e2e     # Playwright against the production build (desktop 1440px + mobile 375px)
npm run verify       # check + lint + build + test:links
npm run og           # re-render public/og.png from scripts/og.html
```

`npm run test:e2e` needs Playwright's Chromium (`npx playwright install chromium`) and a fresh `npm run build`.

## Configuration

Copy `.env.example` to `.env` (or set the variables in CI):

| Variable | Default | Purpose |
| --- | --- | --- |
| `SITE_URL` | `http://localhost:4321` | Public origin. Used for canonical URLs, Open Graph URLs, `robots.txt`, and the sitemap. **Set it for production builds.** |
| `BASE_PATH` | `/` | Sub-path when hosted under a prefix, e.g. `/locklens` on a GitHub Pages project site. All internal links honour it. |
| `LOCKLENS_REPO` | auto | Path to the LockLens checkout whose Markdown is published. |
| `LOCKLENS_REPO_REF` | `main` | Git ref used for "Edit on GitHub" and source links. |

## Documentation pipeline

The repository's Markdown is the single source of truth; nothing is copied into this project.

1. `src/integrations/locklens-source.mjs` mirrors `docs/images/` into `src/generated/repo-images/` (git-ignored) so Astro can optimise screenshots to responsive WebP. In dev it watches the repository and reloads on changes.
2. `src/lib/docs/manifest.ts` assigns each file a route and a sidebar group. Markdown files that are not listed are still published under `/docs/more/<name>/`. A missing file or duplicate route fails the build.
3. `src/lib/docs/index.ts` renders each file at build time: GitHub-flavoured Markdown (tables, task lists), sanitised raw HTML, GitHub-compatible heading IDs, Shiki syntax highlighting, Mermaid diagrams rendered to static SVG (with the diagram source kept in a `<details>`), relative `.md` links rewritten to site routes (fragments included), links to code rewritten to GitHub, and images swapped for optimised versions.
4. Pagefind indexes the article bodies after the build. Search (`⌘K` / `Ctrl K`, or `/`) loads the index only when opened and returns page and heading-level results.

Articles are plain HTML and fully readable without JavaScript. JavaScript adds copy buttons, the active-heading tracker, the mobile drawer and search.

`ANCHOR_ALIASES` in the manifest corrects heading links that are broken upstream (currently `docs/configuration.md` links to `#administrator`, which does not exist; the heading is "Users and the environment administrator"). Remove the alias once the upstream file is fixed.

Three pages are written for the site because the repository has no dedicated page for them: `content/guides/production-topology.md`, `high-availability.md`, and `replication-monitoring.md`. They only summarise and link to repository docs; edit them here.

## Interactive diagrams

All diagrams are hand-built SVG in React islands (`src/islands/`), hydrated only when scrolled into view.

- `diagram/` — shared engine: flow types (colour **and** line pattern per kind), path routing with rounded orthogonal waypoints, zoom/pan on the viewBox, a deterministic step sequencer, offscreen pausing (`IntersectionObserver` + `SVGSVGElement.pauseAnimations()`), reduced-motion support.
- `data/internal.ts` — the internal architecture: nodes, edges, six steps, and per-component details with code references, all taken from the repository docs.
- `data/topology.ts` — the production topologies. Everything outside the LockLens zone is labelled as an illustrative example. Per-mode positions are tweened so the topology morphs between modes.
- `data/incident.ts` — the deterministic incident scenario, timed against the documented rules (adaptive sampling, `blocking.long_chain` at ≥ 30 s and ≥ 3 samples, resolution after 3 clear samples).

Below 1024 px the diagrams switch to guided, stacked layouts instead of shrinking a large canvas.

`tests/architecture.spec.ts` also asserts the accuracy rules on the data: application traffic never touches a LockLens component, monitoring edges only go from PostgreSQL servers to LockLens, and replication stays within a cluster.

## Deployment

The output in `dist/` is static and works on any static host.

```sh
SITE_URL=https://your-domain.example npm run build
```

- **Routes** are generated as `dir/index.html` and every internal link uses a trailing slash, so direct loads and refreshes of nested routes work on any host that serves `index.html` for a directory. Requests without the trailing slash depend on the host (most redirect; with nginx use the `try_files` rule below).
- **404**: configure the host to serve `/404.html` with status 404 (many static hosts, including GitHub Pages and Netlify, pick it up automatically).
- **Sub-path hosting**: set `BASE_PATH`, e.g. `BASE_PATH=/locklens SITE_URL=https://user.github.io npm run build`.
- **Caching**: files under `/_astro/` are content-hashed and can be cached for a year; HTML and `/pagefind/` should revalidate.

Example nginx server block:

```nginx
server {
  listen 80;
  root /var/www/locklens-site;
  location /_astro/ { expires 1y; add_header Cache-Control "public, immutable"; }
  location / { try_files $uri $uri/ $uri/index.html =404; }
  error_page 404 /404.html;
}
```

In CI, check out the LockLens repository next to this site (or set `LOCKLENS_REPO`), then run `npm ci && npm run verify`.

### GitHub Pages

`.github/workflows/deploy.yml` deploys this site to GitHub Pages on every push to `main`, on demand, and once a day (so the docs follow the LockLens repository). It checks out `Huy-8bit/locklens@main` next to the site, takes `SITE_URL` and `BASE_PATH` from the Pages configuration, runs the type check, lint, build and link check, and publishes `dist/`. In the repository settings, Pages must use **GitHub Actions** as its source.
