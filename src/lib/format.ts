export const formatZAR = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return "—";
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const decodeText = (s: string | null | undefined) => {
  if (!s) return "";
  const el = typeof document !== "undefined" ? document.createElement("textarea") : null;
  if (el) {
    el.innerHTML = s;
    return el.value;
  }
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
};

export const slugify = (s: string) =>
  s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
