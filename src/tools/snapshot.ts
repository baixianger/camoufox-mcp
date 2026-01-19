import { z } from 'zod';
import { browserManager } from '../browser/manager.js';

// Input schemas
export const TakeSnapshotInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID to snapshot. Uses active page if not specified.'),
  verbose: z.boolean().default(false).describe('Include all accessibility properties'),
});

// DOM tree extraction script - detects interactive elements
const DOM_TREE_SCRIPT = `
(() => {
  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'menuitem', 'tab', 'checkbox', 'radio',
    'textbox', 'searchbox', 'combobox', 'listbox', 'option',
    'switch', 'slider', 'spinbutton', 'scrollbar'
  ]);

  const INTERACTIVE_TAGS = new Set([
    'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'DETAILS', 'SUMMARY'
  ]);

  let uidCounter = 0;
  const elements = [];

  function isInteractive(el) {
    // Check tag
    if (INTERACTIVE_TAGS.has(el.tagName)) return true;

    // Check role
    const role = el.getAttribute('role');
    if (role && INTERACTIVE_ROLES.has(role)) return true;

    // Check tabindex
    if (el.hasAttribute('tabindex') && el.tabIndex >= 0) return true;

    // Check onclick
    if (el.onclick || el.hasAttribute('onclick')) return true;

    // Check cursor style
    const style = window.getComputedStyle(el);
    if (style.cursor === 'pointer') return true;

    // Check contenteditable
    if (el.isContentEditable) return true;

    return false;
  }

  function getElementInfo(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return null;

    const uid = 'ref_' + (uidCounter++);
    el.setAttribute('data-mcp-uid', uid);

    const info = {
      uid,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || undefined,
      name: el.getAttribute('aria-label') ||
            el.getAttribute('name') ||
            el.getAttribute('title') ||
            (el.tagName === 'INPUT' ? el.placeholder : undefined) ||
            el.textContent?.trim().slice(0, 50) || undefined,
      type: el.getAttribute('type') || undefined,
      value: el.value || undefined,
      checked: el.checked,
      disabled: el.disabled,
      href: el.href || undefined,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };

    // Remove undefined values
    Object.keys(info).forEach(key => {
      if (info[key] === undefined || info[key] === false) {
        delete info[key];
      }
    });

    return info;
  }

  function walk(root) {
    // Use querySelectorAll with a broad selector instead of TreeWalker
    // TreeWalker with FILTER_SKIP doesn't always work as expected
    const allElements = root.querySelectorAll('*');

    for (const el of allElements) {
      if (isInteractive(el)) {
        const info = getElementInfo(el);
        if (info) elements.push(info);
      }
    }
  }

  walk(document.body);

  return {
    elements,
    url: window.location.href,
    title: document.title,
  };
})()
`;

// Result type from DOM script
interface DomTreeResult {
  elements: Array<{
    uid: string;
    tag: string;
    role?: string;
    name?: string;
    type?: string;
    value?: string;
    checked?: boolean;
    disabled?: boolean;
    href?: string;
    rect: { x: number; y: number; width: number; height: number };
  }>;
  url: string;
  title: string;
}

// Tool implementation
export async function takeSnapshot(input: z.infer<typeof TakeSnapshotInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  // Use isolated world for DOM access
  const result = await page.evaluate(DOM_TREE_SCRIPT) as DomTreeResult;

  // Format as text for LLM consumption
  let text = `Page: ${result.title}\nURL: ${result.url}\n\n`;
  text += `Interactive Elements (${result.elements.length}):\n\n`;

  for (const el of result.elements) {
    let line = `[${el.uid}] <${el.tag}>`;
    if (el.role) line += ` role="${el.role}"`;
    if (el.type) line += ` type="${el.type}"`;
    if (el.name) line += ` "${el.name}"`;
    if (el.href) line += ` href="${el.href}"`;
    if (el.value) line += ` value="${el.value}"`;
    if (el.checked) line += ` [checked]`;
    if (el.disabled) line += ` [disabled]`;
    text += line + '\n';
  }

  return {
    content: text,
    elements: result.elements,
    url: result.url,
    title: result.title,
    elementCount: result.elements.length,
  };
}
