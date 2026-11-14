// Optimised URLs for the repository's screenshots (mirrored into
// src/generated/repo-images by the locklens-source integration).
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const modules = import.meta.glob<{ default: ImageMetadata }>('/src/generated/repo-images/*.{png,jpg,jpeg,webp,gif}', { eager: true });

export const repoImages: Record<string, ImageMetadata> = Object.fromEntries(
  Object.entries(modules).map(([p, m]) => [p.split('/').pop() as string, m.default]),
);

export function screenshot(name: string): ImageMetadata {
  const img = repoImages[name];
  if (!img) throw new Error(`Screenshot ${name} not found in the repository's docs/images.`);
  return img;
}

type Resolved = { src: string; width: number; height: number };
let resolvedPromise: Promise<Map<string, Resolved>> | undefined;

/** docs/images/<name> → optimised WebP (max 1440px wide). */
export async function docsImageMap() {
  resolvedPromise ??= (async () => {
    const map = new Map<string, Resolved>();
    for (const [name, meta] of Object.entries(repoImages)) {
      const width = Math.min(meta.width, 1440);
      const img = await getImage({ src: meta, format: 'webp', width, quality: 82 });
      map.set(`docs/images/${name}`, { src: img.src, width, height: Math.round((meta.height * width) / meta.width) });
    }
    return map;
  })();
  return resolvedPromise;
}
