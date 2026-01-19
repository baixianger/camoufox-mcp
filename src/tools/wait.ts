import { z } from 'zod';
import { browserManager } from '../browser/manager.js';

// Input schemas
export const WaitForInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  text: z.string().optional().describe('Text to wait for on the page'),
  selector: z.string().optional().describe('CSS selector to wait for'),
  state: z.enum(['attached', 'detached', 'visible', 'hidden']).default('visible').describe('Element state to wait for'),
  timeout: z.number().default(30000).describe('Timeout in milliseconds'),
});

export const WaitForNavigationInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  url: z.string().optional().describe('URL pattern to wait for (string or regex)'),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).default('load'),
  timeout: z.number().default(30000).describe('Timeout in milliseconds'),
});

// Tool implementations
export async function waitFor(input: z.infer<typeof WaitForInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  if (!input.text && !input.selector) {
    throw new Error('Either "text" or "selector" must be provided');
  }

  try {
    if (input.text) {
      // Wait for text to appear - use locator-based approach
      await page.locator(`text=${input.text}`).first().waitFor({
        state: 'visible',
        timeout: input.timeout,
      });
    } else if (input.selector) {
      // Wait for selector
      await page.waitForSelector(input.selector, {
        state: input.state,
        timeout: input.timeout,
      });
    }

    return {
      success: true,
      text: input.text,
      selector: input.selector,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      text: input.text,
      selector: input.selector,
    };
  }
}

export async function waitForNavigation(input: z.infer<typeof WaitForNavigationInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  try {
    if (input.url) {
      await page.waitForURL(input.url, {
        timeout: input.timeout,
        waitUntil: input.waitUntil,
      });
    } else {
      await page.waitForLoadState(input.waitUntil, {
        timeout: input.timeout,
      });
    }

    return {
      success: true,
      url: page.url(),
      title: await page.title(),
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      url: page.url(),
    };
  }
}
