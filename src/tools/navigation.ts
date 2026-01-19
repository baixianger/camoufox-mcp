import { z } from 'zod';
import { browserManager } from '../browser/manager.js';

// Input schemas
export const NavigateInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID to navigate. Uses active page if not specified.'),
  url: z.string().optional().describe('URL to navigate to (required for "url" type)'),
  type: z.enum(['url', 'back', 'forward', 'reload']).default('url').describe('Navigation type'),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).default('load').describe('When to consider navigation complete'),
  timeout: z.number().optional().describe('Navigation timeout in milliseconds'),
});

// Tool implementation
export async function navigatePage(input: z.infer<typeof NavigateInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  const timeout = input.timeout ?? 30000;
  const waitUntil = input.waitUntil;

  switch (input.type) {
    case 'url':
      if (!input.url) {
        throw new Error('URL is required for navigation type "url"');
      }
      await page.goto(input.url, { timeout, waitUntil });
      break;

    case 'back':
      await page.goBack({ timeout, waitUntil });
      break;

    case 'forward':
      await page.goForward({ timeout, waitUntil });
      break;

    case 'reload':
      await page.reload({ timeout, waitUntil });
      break;
  }

  return {
    url: page.url(),
    title: await page.title(),
    type: input.type,
  };
}
