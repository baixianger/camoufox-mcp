import { z } from 'zod';
import { browserManager } from '../browser/manager.js';
import { loadContextFile, injectContextToContext } from '../browser/context.js';

export const InjectContextInputSchema = z.object({
  contextPath: z.string().describe('Path to a browser context JSON file (Playwright storageState format)'),
  sessionId: z.string().optional().describe('Session ID to inject context into (uses active session if not specified)'),
  pageId: z.string().optional().describe('Page ID — context will be injected into the page\'s session'),
});

export async function injectContextTool(input: z.infer<typeof InjectContextInputSchema>) {
  let context;

  if (input.sessionId) {
    context = browserManager.getSession(input.sessionId);
    if (!context) {
      throw new Error(`Session ${input.sessionId} not found`);
    }
  } else if (input.pageId) {
    const page = browserManager.getPage(input.pageId);
    if (!page) {
      throw new Error(`Page ${input.pageId} not found`);
    }
    context = page.context();
  } else {
    // Use active session
    const activeSessionId = browserManager.getActiveSessionId();
    if (activeSessionId) {
      context = browserManager.getSession(activeSessionId);
    }
    if (!context) {
      // Fallback: use active page's context
      const activePage = browserManager.getActivePage();
      if (!activePage) {
        throw new Error('No active session or page');
      }
      context = activePage.context();
    }
  }

  const contextData = loadContextFile(input.contextPath);
  const result = await injectContextToContext(context, contextData);

  return {
    message: `Injected context from ${input.contextPath}`,
    cookiesInjected: result.cookieCount,
    originsInjected: result.originCount,
  };
}
