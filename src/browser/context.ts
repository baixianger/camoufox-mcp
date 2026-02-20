import { readFileSync } from 'fs';
import type { Page } from 'playwright-core';

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
 * Inject cookies and localStorage into a page.
 */
export async function injectContext(page: Page, contextData: BrowserContextData): Promise<{ cookieCount: number; originCount: number }> {
  const context = page.context();

  // Inject cookies
  if (contextData.cookies.length > 0) {
    await context.addCookies(contextData.cookies);
  }

  // Inject localStorage for each origin
  for (const origin of contextData.origins) {
    if (origin.localStorage.length === 0) continue;

    // Navigate to the origin to set localStorage
    const currentUrl = page.url();
    await page.goto(origin.origin, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.evaluate((items: Array<{ name: string; value: string }>) => {
      for (const item of items) {
        localStorage.setItem(item.name, item.value);
      }
    }, origin.localStorage);

    // Navigate back if we were somewhere else
    if (currentUrl && currentUrl !== 'about:blank') {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    }
  }

  return {
    cookieCount: contextData.cookies.length,
    originCount: contextData.origins.length,
  };
}

/**
 * Load a context file and inject it into a page.
 */
export async function injectContextFromFile(page: Page, filePath: string): Promise<{ cookieCount: number; originCount: number; filePath: string }> {
  const contextData = loadContextFile(filePath);
  const result = await injectContext(page, contextData);
  return { ...result, filePath };
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
