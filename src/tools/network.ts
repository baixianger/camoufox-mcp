import { z } from 'zod';
import { browserManager } from '../browser/manager.js';
import type { Page, Request, Response, Route } from 'playwright-core';

// Network request/response storage per page
interface NetworkEntry {
  id: number;
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  timing: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
  size?: number;
  error?: string;
}

interface InterceptRule {
  urlPattern: string;
  action: 'block' | 'modify';
  modifyResponse?: {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
  };
}

const networkLogs = new Map<string, NetworkEntry[]>();
const interceptRules = new Map<string, InterceptRule[]>();
let entryIdCounter = 0;

// Input schemas
export const StartNetworkCaptureInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  resourceTypes: z.array(z.string()).optional().describe('Filter by resource types (document, xhr, fetch, script, stylesheet, image, etc.)'),
});

export const StopNetworkCaptureInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
});

export const GetNetworkLogsInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  urlPattern: z.string().optional().describe('Filter by URL pattern (regex)'),
  limit: z.number().default(100).describe('Maximum number of entries to return'),
});

export const ClearNetworkLogsInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
});

export const InterceptNetworkInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  urlPattern: z.string().describe('URL pattern to intercept (glob pattern)'),
  action: z.enum(['block', 'modify']).describe('Action to take'),
  modifyResponse: z.object({
    status: z.number().optional(),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
  }).optional().describe('Response modifications (for action="modify")'),
});

export const RemoveInterceptInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  urlPattern: z.string().optional().describe('URL pattern to remove. If not specified, removes all.'),
});

// Helper to get page and its ID
function getPageWithId(pageId?: string): { page: Page; id: string } {
  if (pageId) {
    const page = browserManager.getPage(pageId);
    if (!page) throw new Error(`Page ${pageId} not found`);
    return { page, id: pageId };
  }

  const activePage = browserManager.getActivePage();
  const activeId = browserManager.getActivePageId();
  if (!activePage || !activeId) throw new Error('No active page');
  return { page: activePage, id: activeId };
}

// Setup network listeners
async function setupNetworkListeners(page: Page, pageId: string, resourceTypes?: string[]) {
  // Initialize storage
  if (!networkLogs.has(pageId)) {
    networkLogs.set(pageId, []);
  }

  const logs = networkLogs.get(pageId)!;

  // Request handler
  page.on('request', (request: Request) => {
    const type = request.resourceType();
    if (resourceTypes && !resourceTypes.includes(type)) {
      return;
    }

    const entry: NetworkEntry = {
      id: ++entryIdCounter,
      url: request.url(),
      method: request.method(),
      resourceType: type,
      requestHeaders: request.headers(),
      timing: {
        startTime: Date.now(),
      },
    };

    logs.push(entry);
  });

  // Response handler
  page.on('response', async (response: Response) => {
    const url = response.url();
    const entry = logs.find((e) => e.url === url && !e.status);

    if (entry) {
      entry.status = response.status();
      entry.statusText = response.statusText();
      entry.responseHeaders = response.headers();
      entry.timing.endTime = Date.now();
      entry.timing.duration = entry.timing.endTime - entry.timing.startTime;

      try {
        const body = await response.body();
        entry.size = body.length;
      } catch {
        // Body might not be available
      }
    }
  });

  // Request failed handler
  page.on('requestfailed', (request: Request) => {
    const url = request.url();
    const entry = logs.find((e) => e.url === url && !e.status);

    if (entry) {
      entry.error = request.failure()?.errorText ?? 'Unknown error';
      entry.timing.endTime = Date.now();
      entry.timing.duration = entry.timing.endTime - entry.timing.startTime;
    }
  });
}

// Tool implementations
export async function startNetworkCapture(input: z.infer<typeof StartNetworkCaptureInputSchema>) {
  const { page, id } = getPageWithId(input.pageId);

  // Clear existing logs
  networkLogs.set(id, []);

  // Setup listeners
  await setupNetworkListeners(page, id, input.resourceTypes);

  return {
    success: true,
    message: 'Network capture started',
    pageId: id,
    resourceTypes: input.resourceTypes ?? 'all',
  };
}

export async function stopNetworkCapture(input: z.infer<typeof StopNetworkCaptureInputSchema>) {
  const { id } = getPageWithId(input.pageId);

  const logs = networkLogs.get(id) ?? [];

  return {
    success: true,
    message: 'Network capture stopped',
    pageId: id,
    capturedRequests: logs.length,
  };
}

export async function getNetworkLogs(input: z.infer<typeof GetNetworkLogsInputSchema>) {
  const { id } = getPageWithId(input.pageId);

  let logs = networkLogs.get(id) ?? [];

  // Filter by URL pattern if provided
  if (input.urlPattern) {
    const regex = new RegExp(input.urlPattern);
    logs = logs.filter((entry) => regex.test(entry.url));
  }

  // Limit results
  logs = logs.slice(-input.limit);

  return {
    success: true,
    pageId: id,
    count: logs.length,
    entries: logs.map((entry) => ({
      id: entry.id,
      url: entry.url,
      method: entry.method,
      resourceType: entry.resourceType,
      status: entry.status,
      statusText: entry.statusText,
      duration: entry.timing.duration,
      size: entry.size,
      error: entry.error,
    })),
  };
}

export async function clearNetworkLogs(input: z.infer<typeof ClearNetworkLogsInputSchema>) {
  const { id } = getPageWithId(input.pageId);

  const previousCount = networkLogs.get(id)?.length ?? 0;
  networkLogs.set(id, []);

  return {
    success: true,
    message: 'Network logs cleared',
    pageId: id,
    clearedCount: previousCount,
  };
}

export async function interceptNetwork(input: z.infer<typeof InterceptNetworkInputSchema>) {
  const { page, id } = getPageWithId(input.pageId);

  // Store rule
  if (!interceptRules.has(id)) {
    interceptRules.set(id, []);
  }

  const rules = interceptRules.get(id)!;
  const rule: InterceptRule = {
    urlPattern: input.urlPattern,
    action: input.action,
    modifyResponse: input.modifyResponse,
  };
  rules.push(rule);

  // Setup route handler
  await page.route(input.urlPattern, async (route: Route) => {
    if (input.action === 'block') {
      await route.abort();
    } else if (input.action === 'modify' && input.modifyResponse) {
      await route.fulfill({
        status: input.modifyResponse.status ?? 200,
        headers: input.modifyResponse.headers,
        body: input.modifyResponse.body,
      });
    } else {
      await route.continue();
    }
  });

  return {
    success: true,
    message: `Network intercept rule added: ${input.action} ${input.urlPattern}`,
    pageId: id,
    ruleCount: rules.length,
  };
}

export async function removeIntercept(input: z.infer<typeof RemoveInterceptInputSchema>) {
  const { page, id } = getPageWithId(input.pageId);

  const rules = interceptRules.get(id) ?? [];

  if (input.urlPattern) {
    // Remove specific rule
    const index = rules.findIndex((r) => r.urlPattern === input.urlPattern);
    if (index !== -1) {
      rules.splice(index, 1);
      await page.unroute(input.urlPattern);
    }
  } else {
    // Remove all rules
    for (const rule of rules) {
      try {
        await page.unroute(rule.urlPattern);
      } catch {
        // Ignore errors
      }
    }
    interceptRules.set(id, []);
  }

  return {
    success: true,
    message: input.urlPattern
      ? `Removed intercept rule: ${input.urlPattern}`
      : 'Removed all intercept rules',
    pageId: id,
    remainingRules: interceptRules.get(id)?.length ?? 0,
  };
}
