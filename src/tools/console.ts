import { z } from 'zod';
import { browserManager } from '../browser/manager.js';
import type { Page, ConsoleMessage } from 'playwright-core';

// Console message storage per page
interface ConsoleEntry {
  id: number;
  type: string;
  text: string;
  args: string[];
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  timestamp: number;
}

const consoleLogs = new Map<string, ConsoleEntry[]>();
const consoleListeners = new Map<string, boolean>();
let entryIdCounter = 0;

// Input schemas
export const StartConsoleCaptureSInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  types: z.array(z.enum(['log', 'info', 'warn', 'error', 'debug', 'trace'])).optional()
    .describe('Filter by message types. Default: all types.'),
});

export const StopConsoleCaptureInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
});

export const GetConsoleLogsInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  types: z.array(z.string()).optional().describe('Filter by message types'),
  pattern: z.string().optional().describe('Filter by text pattern (regex)'),
  limit: z.number().default(100).describe('Maximum number of entries to return'),
  onlyErrors: z.boolean().default(false).describe('Only return error and warning messages'),
});

export const ClearConsoleLogsInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
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

// Setup console listener
function setupConsoleListener(page: Page, pageId: string, types?: string[]) {
  if (consoleListeners.get(pageId)) {
    return; // Already listening
  }

  if (!consoleLogs.has(pageId)) {
    consoleLogs.set(pageId, []);
  }

  const logs = consoleLogs.get(pageId)!;

  page.on('console', async (msg: ConsoleMessage) => {
    const type = msg.type();

    // Filter by types if specified
    if (types && !types.includes(type)) {
      return;
    }

    // Get arguments as strings
    const args: string[] = [];
    for (const arg of msg.args()) {
      try {
        const value = await arg.jsonValue();
        args.push(typeof value === 'string' ? value : JSON.stringify(value));
      } catch {
        args.push('[unserializable]');
      }
    }

    const location = msg.location();

    const entry: ConsoleEntry = {
      id: ++entryIdCounter,
      type,
      text: msg.text(),
      args,
      location: location.url ? {
        url: location.url,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber,
      } : undefined,
      timestamp: Date.now(),
    };

    logs.push(entry);

    // Keep logs bounded (max 1000 entries)
    if (logs.length > 1000) {
      logs.shift();
    }
  });

  // Also capture page errors
  page.on('pageerror', (error: Error) => {
    const entry: ConsoleEntry = {
      id: ++entryIdCounter,
      type: 'error',
      text: error.message,
      args: [error.stack ?? error.message],
      timestamp: Date.now(),
    };
    logs.push(entry);
  });

  consoleListeners.set(pageId, true);
}

// Tool implementations
export async function startConsoleCapture(input: z.infer<typeof StartConsoleCaptureSInputSchema>) {
  const { page, id } = getPageWithId(input.pageId);

  // Clear existing logs
  consoleLogs.set(id, []);

  // Setup listener
  setupConsoleListener(page, id, input.types);

  return {
    success: true,
    message: 'Console capture started',
    pageId: id,
    types: input.types ?? 'all',
  };
}

export async function stopConsoleCapture(input: z.infer<typeof StopConsoleCaptureInputSchema>) {
  const { id } = getPageWithId(input.pageId);

  const logs = consoleLogs.get(id) ?? [];
  consoleListeners.set(id, false);

  return {
    success: true,
    message: 'Console capture stopped',
    pageId: id,
    capturedMessages: logs.length,
  };
}

export async function getConsoleLogs(input: z.infer<typeof GetConsoleLogsInputSchema>) {
  const { id } = getPageWithId(input.pageId);

  let logs = consoleLogs.get(id) ?? [];

  // Filter by types
  if (input.types) {
    logs = logs.filter((entry) => input.types!.includes(entry.type));
  }

  // Filter errors only
  if (input.onlyErrors) {
    logs = logs.filter((entry) => entry.type === 'error' || entry.type === 'warn');
  }

  // Filter by pattern
  if (input.pattern) {
    const regex = new RegExp(input.pattern);
    logs = logs.filter((entry) => regex.test(entry.text));
  }

  // Limit results
  logs = logs.slice(-input.limit);

  return {
    success: true,
    pageId: id,
    count: logs.length,
    entries: logs.map((entry) => ({
      id: entry.id,
      type: entry.type,
      text: entry.text,
      args: entry.args,
      location: entry.location,
      timestamp: entry.timestamp,
    })),
  };
}

export async function clearConsoleLogs(input: z.infer<typeof ClearConsoleLogsInputSchema>) {
  const { id } = getPageWithId(input.pageId);

  const previousCount = consoleLogs.get(id)?.length ?? 0;
  consoleLogs.set(id, []);

  return {
    success: true,
    message: 'Console logs cleared',
    pageId: id,
    clearedCount: previousCount,
  };
}
