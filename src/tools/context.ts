import { z } from 'zod';
import { browserManager } from '../browser/manager.js';
import { injectContextFromFile } from '../browser/context.js';

export const InjectContextInputSchema = z.object({
  contextPath: z.string().describe('Path to a browser context JSON file (Playwright storageState format)'),
  pageId: z.string().optional().describe('Page ID (uses active page if not specified)'),
});

export async function injectContextTool(input: z.infer<typeof InjectContextInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  const result = await injectContextFromFile(page, input.contextPath);

  return {
    message: `Injected context from ${result.filePath}`,
    cookiesInjected: result.cookieCount,
    originsInjected: result.originCount,
  };
}
