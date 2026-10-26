import type { Film } from "../shared/data";
import { DEFAULT_ORIGIN, metadataElements, pageMetadata } from "../shared/seo";

export function updatePageMetadata(path: string, film?: Film) {
  const meta = pageMetadata(path, film, import.meta.env.VITE_SITE_ORIGIN || DEFAULT_ORIGIN);
  document.title = meta.title;
  document
    .querySelectorAll(
      'meta[name="description"], meta[name="robots"], link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"], #seo-data',
    )
    .forEach((node) => node.remove());
  for (const { tag, attrs } of metadataElements(meta)) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    document.head.append(node);
  }
  if (!meta.noindex) {
    const node = document.createElement("script");
    node.id = "seo-data";
    node.type = "application/ld+json";
    node.textContent = JSON.stringify(meta.structuredData);
    document.head.append(node);
  }
}
