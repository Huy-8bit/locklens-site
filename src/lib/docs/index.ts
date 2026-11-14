// Build-time documentation pipeline.
//
// Discovers Markdown in the LockLens repository (plus the few site-authored
// guides in content/guides), assigns stable routes from the manifest, and
// renders each file to sanitised HTML with heading anchors, syntax
// highlighting, build-time Mermaid SVG, rewritten cross-document links and
// optimised images. Nothing here runs in the browser.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import GithubSlugger from 'github-slugger';
import { toString as hastToString } from 'hast-util-to-string';
import { visit, SKIP } from 'unist-util-visit';
import type { Element, ElementContent, Root as HastRoot } from 'hast';
import { createHighlighter, type Highlighter } from 'shiki';
import { renderMermaidSVG } from 'beautiful-mermaid';
import { resolveRepoRoot, githubUrl } from '../source.mjs';
import { DOC_INTROS, publishedMarkdown } from './editorial';
import { ANCHOR_ALIASES, DOCS_MANIFEST, type ManifestGroup } from './manifest';

const SITE_GUIDES_DIR = path.resolve(process.cwd(), 'content', 'guides');

export interface DocEntry {
  slug: string;
  source: string; // 'repo:docs/x.md' | 'site:x.md'
  origin: 'repo' | 'site';
  /** Path used to resolve relative links (repo-relative; site guides behave as if they lived in docs/). */
  virtualPath: string;
  absPath: string;
  title: string;
  label: string;
  description: string;
  group: string;
  groupCollapsed: boolean;
  editUrl?: string;
  sourceUrl?: string;
}

export interface TocItem {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface RenderedDoc {
  html: string;
  toc: TocItem[];
  sourceRefs: { label: string; href: string }[];
  images: string[];
}

export interface ImageResolver {
  (repoRelPath: string): { src: string; width: number; height: number } | undefined;
}

/* ------------------------------------------------------------------ */
/* Discovery                                                          */
/* ------------------------------------------------------------------ */

function readTitleAndDescription(markdown: string, fallback: string) {
  const lines = markdown.split(/\r?\n/);
  let title = fallback;
  let i = 0;
  for (; i < lines.length; i++) {
    const m = /^#\s+(.+)$/.exec(lines[i]);
    if (m) {
      title = m[1].trim();
      i++;
      break;
    }
  }
  // First real paragraph after the H1 (skip blockquotes, lists, images, code, tables, headings).
  let inFence = false;
  const para: string[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      if (para.length) break;
      continue;
    }
    if (inFence) continue;
    if (!line.trim()) {
      if (para.length) break;
      continue;
    }
    if (/^(#|>|\||!\[|<|- |\* |\d+\. )/.test(line.trim())) {
      if (para.length) break;
      continue;
    }
    para.push(line.trim());
  }
  let description = para
    .join(' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (description.length > 180) description = description.slice(0, 177).replace(/\s+\S*$/, '') + '…';
  return { title: title.replace(/[`*]/g, ''), description };
}

let cache: DocEntry[] | undefined;

export function getAllDocs(): DocEntry[] {
  if (cache && import.meta.env.PROD) return cache;
  const repoRoot = resolveRepoRoot();
  const entries: DocEntry[] = [];
  const seenSources = new Set<string>();
  const seenSlugs = new Set<string>();

  const add = (group: ManifestGroup | { title: string; collapsed?: boolean }, source: string, slug: string, label?: string) => {
    const [origin, rel] = source.split(':') as ['repo' | 'site', string];
    const absPath = origin === 'repo' ? path.join(repoRoot, rel) : path.join(SITE_GUIDES_DIR, rel);
    if (!existsSync(absPath)) {
      throw new Error(`Documentation manifest refers to a missing file: ${source} (${absPath})`);
    }
    if (seenSlugs.has(slug)) throw new Error(`Duplicate documentation route: /docs/${slug}/`);
    seenSlugs.add(slug);
    seenSources.add(source);
    const md = readFileSync(absPath, 'utf8');
    const { title, description } = readTitleAndDescription(md, label ?? slug);
    entries.push({
      slug,
      source,
      origin,
      virtualPath: origin === 'repo' ? rel : `docs/${rel}`,
      absPath,
      title: label ?? title,
      label: label ?? title,
      description: DOC_INTROS[slug] ?? description,
      group: group.title,
      groupCollapsed: Boolean(group.collapsed),
      editUrl: origin === 'repo' ? githubUrl(rel, { edit: true }) : undefined,
      sourceUrl: origin === 'repo' ? githubUrl(rel) : undefined,
    });
  };

  for (const group of DOCS_MANIFEST) {
    for (const e of group.entries) add(group, e.source, e.slug, e.label);
  }
  cache = entries;
  return entries;
}

export function getDoc(slug: string) {
  return getAllDocs().find((d) => d.slug === slug);
}

export interface NavGroup {
  title: string;
  collapsed: boolean;
  items: { slug: string; label: string }[];
}

export function getNavigation(): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const d of getAllDocs()) {
    let g = groups.find((x) => x.title === d.group);
    if (!g) groups.push((g = { title: d.group, collapsed: d.groupCollapsed, items: [] }));
    g.items.push({ slug: d.slug, label: d.label });
  }
  return groups;
}

export function getPrevNext(slug: string) {
  const all = getAllDocs();
  const i = all.findIndex((d) => d.slug === slug);
  return { prev: i > 0 ? all[i - 1] : undefined, next: i >= 0 && i < all.length - 1 ? all[i + 1] : undefined };
}

export function getRelated(slug: string, limit = 3) {
  const all = getAllDocs();
  const self = all.find((d) => d.slug === slug);
  if (!self) return [];
  return all.filter((d) => d.group === self.group && d.slug !== slug).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Rendering                                                          */
/* ------------------------------------------------------------------ */

let highlighterPromise: Promise<Highlighter> | undefined;
const LANGS = ['bash', 'sh', 'shell', 'sql', 'json', 'yaml', 'go', 'ts', 'js', 'dotenv', 'ini', 'html', 'nginx', 'dockerfile', 'diff', 'make'];
function highlighter() {
  highlighterPromise ??= createHighlighter({ themes: ['github-dark'], langs: LANGS });
  return highlighterPromise;
}

const MERMAID_THEME = {
  bg: '#f0f4f9',
  fg: '#284662',
  line: '#475569',
  accent: '#087a9e',
  muted: '#8392a8',
  surface: '#eaf0f7',
  border: '#becdc3',
  font: 'Inter Variable, Inter, sans-serif',
  transparent: true,
};

const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: '',
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./]],
    img: [...(defaultSchema.attributes?.img ?? []), 'width', 'height', 'align'],
    div: [...(defaultSchema.attributes?.div ?? []), 'align'],
    p: [...(defaultSchema.attributes?.p ?? []), 'align'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align', 'width'],
    th: [...(defaultSchema.attributes?.th ?? []), 'align', 'width'],
  },
};

function el(tagName: string, properties: Element['properties'], children: ElementContent[] = []): Element {
  return { type: 'element', tagName, properties, children };
}

function isImagePath(p: string) {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(p);
}

export async function renderDoc(entry: DocEntry, resolveImage: ImageResolver): Promise<RenderedDoc> {
  const all = getAllDocs();
  const byPath = new Map(all.map((d) => [d.virtualPath, d]));
  // Site guides are addressed as docs/<name>.md; repository files by their real path.
  const markdown = publishedMarkdown(readFileSync(entry.absPath, 'utf8'), entry.slug);
  const hl = await highlighter();
  const toc: TocItem[] = [];
  const sourceRefs = new Map<string, string>();
  const images: string[] = [];
  const baseDir = path.posix.dirname(entry.virtualPath);
  const sitePrefix = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

  const resolveHref = (href: string): { href: string; external: boolean; repoRef?: string; title?: string } => {
    if (/^(https?:|mailto:)/i.test(href)) return { href, external: /^https?:/i.test(href) };
    const alias = (file: string, f?: string) => (f ? (ANCHOR_ALIASES[`${file}#${f}`] ?? f) : f);
    if (href.startsWith('#')) return { href: `#${alias(entry.virtualPath, href.slice(1))}`, external: false };
    const [rawPath, rawFrag] = href.split('#');
    const resolved = path.posix.normalize(path.posix.join(baseDir, decodeURI(rawPath)));
    const frag = alias(resolved, rawFrag);
    const target = byPath.get(resolved);
    if (target) return { href: `${sitePrefix}/docs/${target.slug}/${frag ? '#' + frag : ''}`, external: false, title: target.label };
    if (resolved.startsWith('..')) return { href, external: false };
    const gh = githubUrl(resolved.replace(/\/$/, '')) + (frag ? '#' + frag : '');
    const sourcePath = path.join(resolveRepoRoot(), resolved);
    const title = /\.md$/i.test(resolved) && existsSync(sourcePath)
      ? readTitleAndDescription(readFileSync(sourcePath, 'utf8'), path.posix.basename(resolved, '.md').replace(/[-_]/g, ' ')).title
      : undefined;
    return { href: gh, external: true, repoRef: resolved, title };
  };

  const rehypeLocklens = () => (tree: HastRoot) => {
    const slugger = new GithubSlugger();
    let currentHeading = entry.title;
    let tableIndex = 0;
    visit(tree, 'element', (node, index, parent) => {
      // Drop the H1: the layout renders the title with breadcrumbs.
      if (node.tagName === 'h1' && parent && typeof index === 'number') {
        parent.children.splice(index, 1);
        return [SKIP, index];
      }
      if (/^h[2-6]$/.test(node.tagName)) {
        const text = hastToString(node).trim();
        const id = slugger.slug(text);
        currentHeading = text;
        node.properties = { ...node.properties, id };
        node.children.push(el('a', { className: ['heading-anchor'], href: `#${id}`, ariaLabel: `Link to “${text}”`, dataPagefindIgnore: '' }, [{ type: 'text', value: '#' }]));
        if (node.tagName === 'h2' || node.tagName === 'h3') toc.push({ depth: node.tagName === 'h2' ? 2 : 3, id, text });
        return;
      }
      if (node.tagName === 'a' && typeof node.properties?.href === 'string') {
        const r = resolveHref(node.properties.href);
        node.properties.href = r.href;
        // Replace file-shaped link labels, including labels wrapped in inline code.
        // Preserve authored descriptive labels and actual code examples.
        const label = hastToString(node).trim();
        if (/^(?:[^\s]*\/)?[^\s/]+\.md(?:#[^\s]+)?$/i.test(label)) {
          const title = r.title ?? path.posix.basename(label.split('#')[0], '.md').replace(/[-_]/g, ' ');
          node.children = [{ type: 'text', value: title.charAt(0).toUpperCase() + title.slice(1) }];
        }
        if (r.external) {
          node.properties.className = ['external'];
          node.properties.rel = ['noopener', 'noreferrer'];
        }
        if (r.repoRef && !isImagePath(r.repoRef)) sourceRefs.set(r.repoRef, r.href);
        return;
      }
      if (node.tagName === 'img' && typeof node.properties?.src === 'string') {
        const src = node.properties.src;
        if (/^https?:/i.test(src)) {
          // Remote images (badges) are not fetched at build time: keep their alt text as a link.
          const alt = String(node.properties.alt ?? 'image');
          if (parent && typeof index === 'number') {
            parent.children[index] = el('span', { className: ['chip'] }, [{ type: 'text', value: alt }]);
          }
          return;
        }
        const resolved = path.posix.normalize(path.posix.join(baseDir, decodeURI(src)));
        const img = resolveImage(resolved);
        if (img) {
          images.push(resolved);
          node.properties.src = img.src;
          node.properties.width = img.width;
          node.properties.height = img.height;
          node.properties.loading = 'lazy';
          node.properties.decoding = 'async';
        } else {
          node.properties.src = githubUrl(resolved) + '?raw=true';
        }
        return;
      }
      if (node.tagName === 'table' && parent && typeof index === 'number' && !(parent.type === 'element' && (parent as Element).properties?.className?.toString().includes('table-wrap'))) {
        const head = node.children.find((c): c is Element => c.type === 'element' && c.tagName === 'thead');
        const row = head?.children.find((c): c is Element => c.type === 'element' && c.tagName === 'tr');
        const columns = row?.children.filter((c) => c.type === 'element').length ?? 2;
        node.properties = { ...node.properties, className: [`cols-${columns}`] };
        if (row) for (const cell of row.children) if (cell.type === 'element') cell.properties.scope = 'col';
        tableIndex++;
        parent.children[index] = el('div', {
          className: ['table-wrap'], tabIndex: 0, role: 'region',
          ariaLabel: `${currentHeading} — table ${tableIndex}`,
        }, [node]);
        return index; // revisit: descend into the wrapper so links inside the table are rewritten
      }
      if (node.tagName === 'pre' && parent && typeof index === 'number') {
        const code = node.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
        if (!code) return;
        const cls = (code.properties?.className as string[] | undefined)?.find((c) => c.startsWith('language-'));
        const lang = cls?.slice('language-'.length) ?? 'text';
        const text = hastToString(code).replace(/\n$/, '');
        if (lang === 'mermaid') {
          let figure: Element;
          try {
            const svg = renderMermaidSVG(text, MERMAID_THEME);
            figure = el('figure', { className: ['mermaid-figure'] }, [
              { type: 'raw', value: svg } as unknown as ElementContent,
              el('details', {}, [el('summary', {}, [{ type: 'text', value: 'Diagram source (Mermaid)' }]), el('pre', {}, [el('code', {}, [{ type: 'text', value: text }])])]),
            ]);
          } catch (err) {
            console.warn(`[docs] Mermaid diagram in ${entry.source} could not be rendered: ${(err as Error).message}`);
            figure = el('figure', { className: ['mermaid-figure'] }, [el('pre', {}, [el('code', {}, [{ type: 'text', value: text }])])]);
          }
          parent.children[index] = figure;
          return SKIP;
        }
        const known = hl.getLoadedLanguages().includes(lang);
        const hast = hl.codeToHast(text, { lang: known ? lang : 'text', theme: 'github-dark' });
        const pre = hast.children[0] as Element;
        pre.properties = { ...pre.properties, tabIndex: 0 };
        parent.children[index] = el('div', { className: ['code-block'], dataLang: lang }, [el('span', { className: ['code-lang'] }, [{ type: 'text', value: lang }]), pre]);
        return SKIP;
      }
    });
  };

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeLocklens)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return {
    html: String(file),
    toc,
    images,
    sourceRefs: [...sourceRefs.entries()]
      .filter(([p]) => /^(backend|web|deploy|demo|tests|scripts|\.github|Makefile)/.test(p))
      .map(([label, href]) => ({ label, href })),
  };
}
