import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface PageMetaOptions {
  title: string;
  description?: string;
}

const SITE_ORIGIN = "https://storeinsightshub.com";

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Sets per-route <title>, meta description, canonical and Open Graph tags.
 * Safe to call from any page component.
 */
export function usePageMeta({ title, description }: PageMetaOptions) {
  const { pathname } = useLocation();
  const url = `${SITE_ORIGIN}${pathname}`;

  useEffect(() => {
    document.title = title;
    if (description) {
      setMeta(`meta[name="description"]`, "name", "description", description);
      setMeta(`meta[property="og:description"]`, "property", "og:description", description);
      setMeta(`meta[name="twitter:description"]`, "name", "twitter:description", description);
    }
    setMeta(`meta[property="og:title"]`, "property", "og:title", title);
    setMeta(`meta[name="twitter:title"]`, "name", "twitter:title", title);
    setMeta(`meta[property="og:url"]`, "property", "og:url", url);
    setLink("canonical", url);
  }, [title, description, url]);
}
