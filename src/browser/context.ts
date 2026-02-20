import { readFileSync, writeFileSync } from 'fs';
import type { Page, BrowserContext } from 'playwright-core';

export interface BrowserContextCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface BrowserContextOrigin {
  origin: string;
  localStorage: Array<{ name: string; value: string }>;
}

export interface BrowserContextData {
  cookies: BrowserContextCookie[];
  origins: BrowserContextOrigin[];
}

/**
 * Load and validate a browser context JSON file (Playwright storageState format).
 */
export function loadContextFile(filePath: string): BrowserContextData {
  const raw = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data.cookies)) {
    throw new Error(`Invalid context file: missing "cookies" array in ${filePath}`);
  }
  if (!Array.isArray(data.origins)) {
    throw new Error(`Invalid context file: missing "origins" array in ${filePath}`);
  }

  return data as BrowserContextData;
}

/**
 * Inject cookies into a BrowserContext. Context-level operation — applies to all pages.
 */
export async function injectCookies(context: BrowserContext, cookies: BrowserContextCookie[]): Promise<number> {
  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }
  return cookies.length;
}

/**
 * Inject localStorage for each origin using a temporary page.
 * Context-level operation — localStorage persists for all pages visiting the same origin.
 */
export async function injectLocalStorage(context: BrowserContext, origins: BrowserContextOrigin[]): Promise<number> {
  const originsWithData = origins.filter(o => o.localStorage.length > 0);
  if (originsWithData.length === 0) return 0;

  // Use a temporary page to set localStorage for each origin
  const tempPage = await context.newPage();
  try {
    for (const origin of originsWithData) {
      await tempPage.goto(origin.origin, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await tempPage.evaluate((items: Array<{ name: string; value: string }>) => {
        for (const item of items) {
          localStorage.setItem(item.name, item.value);
        }
      }, origin.localStorage);
    }
  } finally {
    await tempPage.close();
  }

  return originsWithData.length;
}

/**
 * Inject cookies and localStorage into a BrowserContext.
 * Both are context-level — only needs to be called once.
 */
export async function injectContextToContext(context: BrowserContext, contextData: BrowserContextData): Promise<{ cookieCount: number; originCount: number }> {
  const cookieCount = await injectCookies(context, contextData.cookies);
  const originCount = await injectLocalStorage(context, contextData.origins);
  return { cookieCount, originCount };
}

/**
 * Inject cookies and localStorage into a page's context.
 * Convenience wrapper for the inject_context MCP tool.
 */
export async function injectContext(page: Page, contextData: BrowserContextData): Promise<{ cookieCount: number; originCount: number }> {
  return injectContextToContext(page.context(), contextData);
}

/**
 * Load a context file and inject it into a page's context.
 */
export async function injectContextFromFile(page: Page, filePath: string): Promise<{ cookieCount: number; originCount: number; filePath: string }> {
  const contextData = loadContextFile(filePath);
  const result = await injectContext(page, contextData);
  return { ...result, filePath };
}

/**
 * Export cookies and localStorage from a BrowserContext to BrowserContextData.
 * Collects cookies via context.cookies() and localStorage by navigating
 * a temp page to each cookie origin.
 */
export async function saveContext(context: BrowserContext): Promise<BrowserContextData> {
  const cookies = await context.cookies() as BrowserContextCookie[];

  // Collect unique origins from cookies
  const originSet = new Set<string>();
  for (const cookie of cookies) {
    const protocol = cookie.secure ? 'https' : 'http';
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    originSet.add(`${protocol}://${domain}`);
  }

  const origins: BrowserContextOrigin[] = [];

  if (originSet.size > 0) {
    const tempPage = await context.newPage();
    try {
      for (const origin of originSet) {
        try {
          await tempPage.goto(origin, { waitUntil: 'domcontentloaded', timeout: 10000 });
          const items = await tempPage.evaluate(() => {
            const result: Array<{ name: string; value: string }> = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) {
                result.push({ name: key, value: localStorage.getItem(key) ?? '' });
              }
            }
            return result;
          });
          if (items.length > 0) {
            origins.push({ origin, localStorage: items });
          }
        } catch {
          // Skip origins we can't navigate to
        }
      }
    } finally {
      await tempPage.close();
    }
  }

  return { cookies, origins };
}

/**
 * Export cookies and localStorage from a BrowserContext and write to a JSON file.
 */
export async function saveContextToFile(context: BrowserContext, outputPath: string): Promise<{ cookieCount: number; originCount: number; outputPath: string }> {
  const data = await saveContext(context);
  writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  return {
    cookieCount: data.cookies.length,
    originCount: data.origins.length,
    outputPath,
  };
}

/**
 * Merge multiple context files into a single BrowserContextData.
 */
export function mergeContextFiles(filePaths: string[]): BrowserContextData {
  const merged: BrowserContextData = { cookies: [], origins: [] };

  for (const filePath of filePaths) {
    const data = loadContextFile(filePath);
    merged.cookies.push(...data.cookies);
    merged.origins.push(...data.origins);
  }

  return merged;
}
