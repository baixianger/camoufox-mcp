import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { browserManager } from './browser/manager.js';
import { loadSettings, getConfigPaths, initUserConfig } from './config/loader.js';

// Import tool implementations
import {
  listPages,
  newPage,
  selectPage,
  closePage,
  ListPagesInputSchema,
  NewPageInputSchema,
  SelectPageInputSchema,
  ClosePageInputSchema,
} from './tools/tabs.js';

import { navigatePage, NavigateInputSchema } from './tools/navigation.js';

import { takeSnapshot, TakeSnapshotInputSchema } from './tools/snapshot.js';

import { takeScreenshot, TakeScreenshotInputSchema } from './tools/screenshot.js';

import {
  evaluateMainworld,
  evaluateIsolated,
  getFrameworkState,
  EvaluateMainworldInputSchema,
  EvaluateIsolatedInputSchema,
  GetFrameworkStateInputSchema,
} from './tools/evaluate.js';

import {
  click,
  hover,
  fill,
  fillForm,
  pressKey,
  drag,
  ClickInputSchema,
  HoverInputSchema,
  FillInputSchema,
  FillFormInputSchema,
  PressKeyInputSchema,
  DragInputSchema,
} from './tools/interaction.js';

import {
  waitFor,
  waitForNavigation,
  WaitForInputSchema,
  WaitForNavigationInputSchema,
} from './tools/wait.js';

import {
  dismissPopups,
  reloadSettings,
  getPageText,
  DismissPopupsInputSchema,
  ReloadSettingsInputSchema,
  GetPageTextInputSchema,
} from './tools/utility.js';

import {
  startRecording,
  stopRecording,
  getRecordingStatus,
  StartRecordingInputSchema,
  StopRecordingInputSchema,
  GetRecordingStatusInputSchema,
} from './tools/recording.js';

import {
  startNetworkCapture,
  stopNetworkCapture,
  getNetworkLogs,
  clearNetworkLogs,
  interceptNetwork,
  removeIntercept,
  StartNetworkCaptureInputSchema,
  StopNetworkCaptureInputSchema,
  GetNetworkLogsInputSchema,
  ClearNetworkLogsInputSchema,
  InterceptNetworkInputSchema,
  RemoveInterceptInputSchema,
} from './tools/network.js';

import {
  startConsoleCapture,
  stopConsoleCapture,
  getConsoleLogs,
  clearConsoleLogs,
  StartConsoleCaptureSInputSchema,
  StopConsoleCaptureInputSchema,
  GetConsoleLogsInputSchema,
  ClearConsoleLogsInputSchema,
} from './tools/console.js';

import {
  injectContextTool,
  InjectContextInputSchema,
} from './tools/context.js';

import {
  createSession,
  listSessions,
  saveSession,
  closeSession,
  listContextFiles,
  CreateSessionInputSchema,
  ListSessionsInputSchema,
  SaveSessionInputSchema,
  CloseSessionInputSchema,
  ListContextFilesInputSchema,
} from './tools/session.js';

// Tool definitions for MCP
const TOOLS = [
  // Tab management
  {
    name: 'list_pages',
    description: 'List all open browser pages/tabs',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'new_page',
    description: 'Create a new browser page/tab, optionally navigating to a URL. Specify sessionId to create in a specific session.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to after creating the page' },
        sessionId: { type: 'string', description: 'Session ID to create the page in (uses active session if not specified)' },
      },
      required: [],
    },
  },
  {
    name: 'select_page',
    description: 'Set a page as the active page for subsequent operations',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'The ID of the page to select' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'close_page',
    description: 'Close a browser page/tab',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'The ID of the page to close' },
      },
      required: ['pageId'],
    },
  },

  // Navigation
  {
    name: 'navigate_page',
    description: 'Navigate to a URL or go back/forward/reload',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        url: { type: 'string', description: 'URL to navigate to (required for type="url")' },
        type: {
          type: 'string',
          enum: ['url', 'back', 'forward', 'reload'],
          default: 'url',
          description: 'Navigation type',
        },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          default: 'load',
          description: 'When to consider navigation complete',
        },
        timeout: { type: 'number', description: 'Timeout in milliseconds' },
      },
      required: [],
    },
  },

  // Snapshot & Screenshot
  {
    name: 'take_snapshot',
    description: 'Take a text snapshot of the page with interactive element UIDs for targeting',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        verbose: { type: 'boolean', default: false, description: 'Include all accessibility properties' },
      },
      required: [],
    },
  },
  {
    name: 'take_screenshot',
    description: 'Take a screenshot of the page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        fullPage: { type: 'boolean', default: false, description: 'Capture full scrollable page' },
        uid: { type: 'string', description: 'Element UID to screenshot (from snapshot)' },
        format: { type: 'string', enum: ['png', 'jpeg', 'webp'], default: 'png' },
        quality: { type: 'number', minimum: 0, maximum: 100, description: 'Quality for JPEG/WebP' },
      },
      required: [],
    },
  },

  // JavaScript evaluation
  {
    name: 'evaluate_mainworld',
    description: `Execute JavaScript in the page's MAIN execution context (same as browser DevTools console).

USE THIS TOOL WHEN YOU NEED TO:
- Access window globals like window.__NUXT__, window.__NEXT_DATA__, window.__APP_STATE__
- Read framework hydration state (Next.js, Nuxt.js, Vue, React, etc.)
- Access variables/functions defined by the page's own scripts
- Interact with third-party libraries loaded by the page (jQuery, etc.)

CRITICAL LIMITATIONS:
- NO async/await support - scripts must be SYNCHRONOUS only
- NO Promise, fetch(), setTimeout callbacks
- Script will be REJECTED if it contains async patterns

EXAMPLES:
- "window.__NUXT__" → Returns Nuxt.js state
- "window.__NEXT_DATA__" → Returns Next.js props
- "typeof jQuery !== 'undefined' ? jQuery.fn.jquery : null" → Check jQuery version`,
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        script: { type: 'string', description: 'SYNCHRONOUS JavaScript expression. No async/await/Promise/fetch allowed. Returns the expression result.' },
      },
      required: ['script'],
    },
  },
  {
    name: 'evaluate_isolated',
    description: `Execute JavaScript in an ISOLATED context (sandboxed, separate from page scripts).

USE THIS TOOL WHEN YOU NEED TO:
- Make async operations (fetch, setTimeout, Promises)
- Query/manipulate the DOM without affecting page state
- Run code that shouldn't interfere with page scripts
- Perform async data extraction or waiting

LIMITATIONS:
- CANNOT access window globals (window.__NUXT__, etc. will be undefined)
- CANNOT call functions defined by page scripts
- Only has access to DOM and standard browser APIs

EXAMPLES:
- "await fetch('/api/data').then(r => r.json())" → Make API calls
- "document.querySelectorAll('.item').length" → Count elements
- "await new Promise(r => setTimeout(r, 1000))" → Wait/delay`,
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        script: { type: 'string', description: 'JavaScript code (async/await allowed). Returns the expression result.' },
      },
      required: ['script'],
    },
  },
  {
    name: 'get_framework_state',
    description: 'Extract Next.js/Nuxt.js hydration state from the page',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        framework: { type: 'string', enum: ['auto', 'nextjs', 'nuxt'], default: 'auto' },
      },
      required: [],
    },
  },

  // Interaction
  {
    name: 'click',
    description: 'Click an element by its UID from snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        uid: { type: 'string', description: 'Element UID from snapshot' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' },
        clickCount: { type: 'number', default: 1, description: '1 for single click, 2 for double' },
        modifiers: {
          type: 'array',
          items: { type: 'string', enum: ['Alt', 'Control', 'Meta', 'Shift'] },
          description: 'Modifier keys to hold',
        },
      },
      required: ['uid'],
    },
  },
  {
    name: 'hover',
    description: 'Hover over an element by its UID',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        uid: { type: 'string', description: 'Element UID from snapshot' },
      },
      required: ['uid'],
    },
  },
  {
    name: 'fill',
    description: 'Fill a form field (input, textarea, select) by its UID',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        uid: { type: 'string', description: 'Element UID from snapshot' },
        value: { type: 'string', description: 'Value to fill in' },
      },
      required: ['uid', 'value'],
    },
  },
  {
    name: 'fill_form',
    description: 'Fill multiple form fields at once',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              uid: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['uid', 'value'],
          },
          description: 'List of fields to fill',
        },
      },
      required: ['fields'],
    },
  },
  {
    name: 'press_key',
    description: 'Press a keyboard key or combination',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        key: { type: 'string', description: 'Key to press (e.g., "Enter", "Tab", "Control+a")' },
      },
      required: ['key'],
    },
  },
  {
    name: 'drag',
    description: 'Drag an element to another element',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        fromUid: { type: 'string', description: 'Element UID to drag from' },
        toUid: { type: 'string', description: 'Element UID to drag to' },
      },
      required: ['fromUid', 'toUid'],
    },
  },

  // Wait
  {
    name: 'wait_for',
    description: 'Wait for text or selector to appear on the page',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        text: { type: 'string', description: 'Text to wait for' },
        selector: { type: 'string', description: 'CSS selector to wait for' },
        state: {
          type: 'string',
          enum: ['attached', 'detached', 'visible', 'hidden'],
          default: 'visible',
        },
        timeout: { type: 'number', default: 30000, description: 'Timeout in milliseconds' },
      },
      required: [],
    },
  },
  {
    name: 'wait_for_navigation',
    description: 'Wait for page navigation to complete',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        url: { type: 'string', description: 'URL pattern to wait for' },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          default: 'load',
        },
        timeout: { type: 'number', default: 30000, description: 'Timeout in milliseconds' },
      },
      required: [],
    },
  },

  // Utility
  {
    name: 'dismiss_popups',
    description: 'Dismiss cookie consent popups and overlays',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        maxAttempts: { type: 'number', default: 3, description: 'Maximum attempts' },
        customSelectors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional selectors to try',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_page_text',
    description: 'Extract text content from the page',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        selector: { type: 'string', description: 'CSS selector (defaults to body)' },
      },
      required: [],
    },
  },
  {
    name: 'reload_settings',
    description: 'Reload settings from config file',
    inputSchema: {
      type: 'object',
      properties: {
        configPath: { type: 'string', description: 'Path to settings.json file' },
      },
      required: [],
    },
  },
  {
    name: 'get_config_paths',
    description: 'Get all config file paths (user config, package default, active)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'init_user_config',
    description: 'Initialize user config directory (~/.config/camoufox-mcp) with default settings',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // Recording
  {
    name: 'start_recording',
    description: 'Start recording user interactions (clicks, scrolls, inputs)',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
      },
      required: [],
    },
  },
  {
    name: 'stop_recording',
    description: 'Stop recording and return captured actions',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
      },
      required: [],
    },
  },
  {
    name: 'get_recording_status',
    description: 'Get current recording status',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
      },
      required: [],
    },
  },

  // Network
  {
    name: 'start_network_capture',
    description: 'Start capturing network requests',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        resourceTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by resource types (document, xhr, fetch, script, etc.)',
        },
      },
      required: [],
    },
  },
  {
    name: 'stop_network_capture',
    description: 'Stop capturing network requests',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
      },
      required: [],
    },
  },
  {
    name: 'get_network_logs',
    description: 'Get captured network request logs',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        urlPattern: { type: 'string', description: 'Filter by URL pattern (regex)' },
        limit: { type: 'number', default: 100, description: 'Maximum entries to return' },
      },
      required: [],
    },
  },
  {
    name: 'clear_network_logs',
    description: 'Clear captured network logs',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
      },
      required: [],
    },
  },
  {
    name: 'intercept_network',
    description: 'Intercept and block/modify network requests',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        urlPattern: { type: 'string', description: 'URL pattern to intercept (glob)' },
        action: { type: 'string', enum: ['block', 'modify'], description: 'Action to take' },
        modifyResponse: {
          type: 'object',
          properties: {
            status: { type: 'number' },
            headers: { type: 'object' },
            body: { type: 'string' },
          },
          description: 'Response modifications (for action="modify")',
        },
      },
      required: ['urlPattern', 'action'],
    },
  },
  {
    name: 'remove_intercept',
    description: 'Remove network intercept rules',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        urlPattern: { type: 'string', description: 'URL pattern to remove (omit to remove all)' },
      },
      required: [],
    },
  },

  // Console
  {
    name: 'start_console_capture',
    description: 'Start capturing browser console messages',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        types: {
          type: 'array',
          items: { type: 'string', enum: ['log', 'info', 'warn', 'error', 'debug', 'trace'] },
          description: 'Filter by message types',
        },
      },
      required: [],
    },
  },
  {
    name: 'stop_console_capture',
    description: 'Stop capturing console messages',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
      },
      required: [],
    },
  },
  {
    name: 'get_console_logs',
    description: 'Get captured console messages',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
        types: { type: 'array', items: { type: 'string' }, description: 'Filter by message types' },
        pattern: { type: 'string', description: 'Filter by text pattern (regex)' },
        limit: { type: 'number', default: 100, description: 'Maximum entries to return' },
        onlyErrors: { type: 'boolean', default: false, description: 'Only return errors/warnings' },
      },
      required: [],
    },
  },
  {
    name: 'clear_console_logs',
    description: 'Clear captured console logs',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID (uses active page if not specified)' },
      },
      required: [],
    },
  },

  // Context injection
  {
    name: 'inject_context',
    description: 'Inject browser context (cookies + localStorage) from a JSON file into a session or page\'s context. The file should follow Playwright\'s storageState format with cookies[] and origins[].localStorage[].',
    inputSchema: {
      type: 'object',
      properties: {
        contextPath: { type: 'string', description: 'Path to a browser context JSON file (Playwright storageState format)' },
        sessionId: { type: 'string', description: 'Session ID to inject into (uses active session if not specified)' },
        pageId: { type: 'string', description: 'Page ID — context will be injected into the page\'s session' },
      },
      required: ['contextPath'],
    },
  },

  // Session management
  {
    name: 'create_session',
    description: 'Create a new isolated browser session with its own cookies and localStorage. Optionally pre-load context from a JSON file.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Human-readable name for the session' },
        contextPath: { type: 'string', description: 'Path to a browser context JSON file to pre-load' },
      },
      required: [],
    },
  },
  {
    name: 'list_sessions',
    description: 'List all browser sessions with their page counts and metadata',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'save_session',
    description: 'Export a session\'s cookies and localStorage to a JSON file (Playwright storageState format)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'The session ID to save' },
        outputPath: { type: 'string', description: 'File path to write the session state JSON' },
      },
      required: ['sessionId', 'outputPath'],
    },
  },
  {
    name: 'close_session',
    description: 'Close a browser session and all its pages',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'The session ID to close' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'list_context_files',
    description: 'List available context files registered in settings. Use create_session with a contextPath to load one on demand.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Tool handler mapping
const toolHandlers: Record<string, (args: any) => Promise<any>> = {
  list_pages: () => listPages(),
  new_page: (args) => newPage(NewPageInputSchema.parse(args)),
  select_page: (args) => selectPage(SelectPageInputSchema.parse(args)),
  close_page: (args) => closePage(ClosePageInputSchema.parse(args)),
  navigate_page: (args) => navigatePage(NavigateInputSchema.parse(args)),
  take_snapshot: (args) => takeSnapshot(TakeSnapshotInputSchema.parse(args)),
  take_screenshot: (args) => takeScreenshot(TakeScreenshotInputSchema.parse(args)),
  evaluate_mainworld: (args) => evaluateMainworld(EvaluateMainworldInputSchema.parse(args)),
  evaluate_isolated: (args) => evaluateIsolated(EvaluateIsolatedInputSchema.parse(args)),
  get_framework_state: (args) => getFrameworkState(GetFrameworkStateInputSchema.parse(args)),
  click: (args) => click(ClickInputSchema.parse(args)),
  hover: (args) => hover(HoverInputSchema.parse(args)),
  fill: (args) => fill(FillInputSchema.parse(args)),
  fill_form: (args) => fillForm(FillFormInputSchema.parse(args)),
  press_key: (args) => pressKey(PressKeyInputSchema.parse(args)),
  drag: (args) => drag(DragInputSchema.parse(args)),
  wait_for: (args) => waitFor(WaitForInputSchema.parse(args)),
  wait_for_navigation: (args) => waitForNavigation(WaitForNavigationInputSchema.parse(args)),
  dismiss_popups: (args) => dismissPopups(DismissPopupsInputSchema.parse(args)),
  get_page_text: (args) => getPageText(GetPageTextInputSchema.parse(args)),
  reload_settings: (args) => reloadSettings(ReloadSettingsInputSchema.parse(args)),
  get_config_paths: async () => ({ paths: getConfigPaths() }),
  init_user_config: async () => ({ configPath: initUserConfig(), message: 'User config initialized' }),

  // Recording
  start_recording: (args) => startRecording(StartRecordingInputSchema.parse(args)),
  stop_recording: (args) => stopRecording(StopRecordingInputSchema.parse(args)),
  get_recording_status: (args) => getRecordingStatus(GetRecordingStatusInputSchema.parse(args)),

  // Network
  start_network_capture: (args) => startNetworkCapture(StartNetworkCaptureInputSchema.parse(args)),
  stop_network_capture: (args) => stopNetworkCapture(StopNetworkCaptureInputSchema.parse(args)),
  get_network_logs: (args) => getNetworkLogs(GetNetworkLogsInputSchema.parse(args)),
  clear_network_logs: (args) => clearNetworkLogs(ClearNetworkLogsInputSchema.parse(args)),
  intercept_network: (args) => interceptNetwork(InterceptNetworkInputSchema.parse(args)),
  remove_intercept: (args) => removeIntercept(RemoveInterceptInputSchema.parse(args)),

  // Console
  start_console_capture: (args) => startConsoleCapture(StartConsoleCaptureSInputSchema.parse(args)),
  stop_console_capture: (args) => stopConsoleCapture(StopConsoleCaptureInputSchema.parse(args)),
  get_console_logs: (args) => getConsoleLogs(GetConsoleLogsInputSchema.parse(args)),
  clear_console_logs: (args) => clearConsoleLogs(ClearConsoleLogsInputSchema.parse(args)),

  // Context injection
  inject_context: (args) => injectContextTool(InjectContextInputSchema.parse(args)),

  // Session management
  create_session: (args) => createSession(CreateSessionInputSchema.parse(args)),
  list_sessions: () => listSessions(),
  save_session: (args) => saveSession(SaveSessionInputSchema.parse(args)),
  close_session: (args) => closeSession(CloseSessionInputSchema.parse(args)),
  list_context_files: () => listContextFiles(),
};

/**
 * Create and configure the MCP server.
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'camoufox-mcp',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Tools that don't need browser initialization
    const noBrowserTools = ['reload_settings', 'get_config_paths', 'init_user_config'];

    // Ensure browser is initialized for browser-related tools
    if (!noBrowserTools.includes(name) && !browserManager.isInitialized()) {
      const settings = loadSettings();
      await browserManager.initialize(settings);
    }

    const handler = toolHandlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await handler(args ?? {});

      // Handle screenshot specially (return image content)
      if (name === 'take_screenshot' && result.data) {
        return {
          content: [
            {
              type: 'image',
              data: result.data,
              mimeType: result.mimeType,
            },
            {
              type: 'text',
              text: `Screenshot of ${result.url} (${result.title})`,
            },
          ],
        };
      }

      // Return text content for other tools
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: String(error),
            }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Start the MCP server.
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('[camoufox-mcp] Received SIGINT, shutting down...');
    await browserManager.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('[camoufox-mcp] Received SIGTERM, shutting down...');
    await browserManager.shutdown();
    process.exit(0);
  });

  await server.connect(transport);
  console.error('[camoufox-mcp] Server started');
}
