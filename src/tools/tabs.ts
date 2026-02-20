import { z } from 'zod';
import { browserManager } from '../browser/manager.js';

// Input schemas
export const ListPagesInputSchema = z.object({});

export const NewPageInputSchema = z.object({
  url: z.string().optional().describe('URL to navigate to after creating the page'),
  sessionId: z.string().optional().describe('Session ID to create the page in (uses active session if not specified)'),
});

export const SelectPageInputSchema = z.object({
  pageId: z.string().describe('The ID of the page to select as active'),
});

export const ClosePageInputSchema = z.object({
  pageId: z.string().describe('The ID of the page to close'),
});

// Tool implementations
export async function listPages() {
  const pages = await browserManager.listPages();
  return {
    pages,
    activePageId: browserManager.getActivePageId(),
    count: pages.length,
  };
}

export async function newPage(input: z.infer<typeof NewPageInputSchema>) {
  const result = await browserManager.createPage(input.url, input.sessionId);
  const sessionId = browserManager.getSessionForPage(result.pageId);
  return {
    pageId: result.pageId,
    url: result.url,
    sessionId,
    message: `Created new page${input.url ? ` and navigated to ${input.url}` : ''}${sessionId ? ` in session ${sessionId}` : ''}`,
  };
}

export async function selectPage(input: z.infer<typeof SelectPageInputSchema>) {
  browserManager.setActivePage(input.pageId);
  const page = browserManager.getPage(input.pageId);
  return {
    pageId: input.pageId,
    url: page?.url() ?? '',
    message: `Page ${input.pageId} is now active`,
  };
}

export async function closePage(input: z.infer<typeof ClosePageInputSchema>) {
  await browserManager.closePage(input.pageId);
  return {
    pageId: input.pageId,
    message: `Page ${input.pageId} closed`,
    remainingPages: browserManager.getPageCount(),
  };
}
