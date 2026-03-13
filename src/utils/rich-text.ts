"use client";

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
]);

function stripAttributes(element: HTMLElement) {
  [...element.attributes].forEach((attribute) => {
    element.removeAttribute(attribute.name);
  });
}

function normalizeBlockElement(element: HTMLElement) {
  if (element.tagName.toLowerCase() === "div") {
    const paragraph = element.ownerDocument.createElement("p");
    paragraph.innerHTML = element.innerHTML;
    element.replaceWith(paragraph);
    return paragraph;
  }

  return element;
}

function cleanNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) return;

  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  const rawElement = node as HTMLElement;
  const element = normalizeBlockElement(rawElement);
  const tagName = element.tagName.toLowerCase();

  [...element.childNodes].forEach(cleanNode);

  if (!ALLOWED_TAGS.has(tagName)) {
    const parent = element.parentNode;
    if (!parent) return;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
    return;
  }

  stripAttributes(element);

  if (
    ["p", "h1", "h2", "h3", "blockquote"].includes(tagName) &&
    !element.textContent?.trim() &&
    !element.querySelector("br, ul, ol")
  ) {
    element.innerHTML = "<br>";
  }
}

export function sanitizeRichTextHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    return html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<div>/gi, "<p>")
      .replace(/<\/div>/gi, "</p>")
      .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName: string) => {
        const normalizedTag = tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(normalizedTag)) return "";
        return match.startsWith("</")
          ? `</${normalizedTag}>`
          : `<${normalizedTag}>`;
      })
      .trim();
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = document.body.firstElementChild;

  if (!root) return "";

  [...root.childNodes].forEach(cleanNode);

  return root.innerHTML
    .replace(/<p><br><\/p>/g, "<p><br></p>")
    .replace(/\s+$/g, "")
    .trim();
}

export function isRichTextEmpty(html: string): boolean {
  if (!html) return true;
  if (typeof window === "undefined") {
    return html.replace(/<[^>]+>/g, "").trim().length === 0;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const text = document.body.textContent?.replace(/\u00a0/g, " ").trim() || "";

  return text.length === 0 && !document.body.querySelector("li");
}
