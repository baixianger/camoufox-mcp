import type { Browser, Page, BrowserContext } from 'playwright-core';
import { randomUUID } from 'crypto';
import { ensureCamoufoxInstalled } from './installer.js';
import type { Settings } from '../config/types.js';
import type {
  BrowserState,
  PageInfo,
  PageMetadata,
  CreatePageResult,
  SessionInfo,
  SessionMetadata,
} from './types.js';
import { loadContextFile, injectContextToContext } from './context.js';

/**
 * BrowserManager handles browser lifecycle, session management, and page management.
 * Provides a clean interface for MCP tools to interact with Camoufox.
 */
export class BrowserManager {
  private state: BrowserState = {
    initialized: false,
    browser: null,
    pages: new Map(),
    activePageId: null,
    pageMetadata: new Map(),
    sessions: new Map(),
    sessionMetadata: new Map(),
    pageToSession: new Map(),
    activeSessionId: null,
  };

  private settings: Settings | null = null;

  /**
   * Initialize the browser manager with settings.
   * This will auto-download Camoufox if not installed.
   */
  async initialize(settings: Settings): Promise<void> {
    if (this.state.initialized) {
      return;
    }

    this.settings = settings;

    // Ensure Camoufox is installed (auto-download if needed)
    await ensureCamoufoxInstalled();

    // Dynamic import to avoid loading before install check
    const { Camoufox } = await import('camoufox-js');

    // Build launch options from settings
    const launchOptions: Record<string, unknown> = {
      headless: settings.browser.headless,
      main_world_eval: true, // Always enable for mw: prefix support
      humanize: settings.browser.humanize,
      enable_cache: settings.browser.enableCache,
      window: settings.browser.viewport,
      block_images: settings.browser.blockImages,
      block_webrtc: settings.browser.blockWebrtc,
    };

    // Add proxy if enabled
    if (settings.proxy.enabled && settings.proxy.server) {
      launchOptions.proxy = {
        server: settings.proxy.server,
        username: settings.proxy.username || undefined,
        password: settings.proxy.password || undefined,
      };
      launchOptions.geoip = settings.proxy.geoip;
    }

    console.error('[camoufox-mcp] Launching Camoufox browser...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserOrContext = await Camoufox(launchOptions as any);

    // Camoufox may return a BrowserContext or a Browser depending on options.
    // We need the Browser object for multi-context support.
    // BrowserContext has addCookies; Browser does not.
    if ('addCookies' in browserOrContext) {
      // It's a BrowserContext — get the parent Browser
      const ctx = browserOrContext as unknown as BrowserContext;
      this.state.browser = ctx.browser()!;
      // Close the default context Camoufox created — we'll create our own
      await ctx.close();
    } else {
      this.state.browser = browserOrContext as Browser;
    }

    this.state.initialized = true;
    console.error('[camoufox-mcp] Browser ready.');

    if (settings.contextPaths.length > 0) {
      console.error(`[camoufox-mcp] ${settings.contextPaths.length} context file(s) registered. Use create_session to load on demand.`);
    }
  }

  /**
   * Check if the browser is initialized.
   */
  isInitialized(): boolean {
    return this.state.initialized && this.state.browser !== null;
  }

  /**
   * Get the list of registered context file paths from settings.
   */
  getRegisteredContextPaths(): string[] {
    return this.settings?.contextPaths ?? [];
  }

  // --- Session management ---

  /**
   * Create a new isolated session (BrowserContext).
   * Optionally inject cookies/localStorage from a context file.
   */
  async createSession(options?: { name?: string; contextPath?: string }): Promise<string> {
    this.ensureInitialized();

    const sessionId = randomUUID();
    const context = await this.state.browser!.newContext();

    // Inject context data if a contextPath is provided
    if (options?.contextPath) {
      const contextData = loadContextFile(options.contextPath);
      const result = await injectContextToContext(context, contextData);
      console.error(`[camoufox-mcp] Session ${sessionId}: injected ${result.cookieCount} cookies, ${result.originCount} origins from ${options.contextPath}`);
    }

    this.state.sessions.set(sessionId, context);
    this.state.sessionMetadata.set(sessionId, {
      name: options?.name,
      contextPath: options?.contextPath,
      createdAt: new Date(),
    });

    // Set as active session if none is active
    if (!this.state.activeSessionId) {
      this.state.activeSessionId = sessionId;
    }

    return sessionId;
  }

  /**
   * Get a session's BrowserContext by ID.
   */
  getSession(sessionId: string): BrowserContext | undefined {
    return this.state.sessions.get(sessionId);
  }

  /**
   * List all sessions with their info.
   */
  listSessions(): SessionInfo[] {
    const sessions: SessionInfo[] = [];

    for (const [sessionId, _context] of this.state.sessions) {
      const metadata = this.state.sessionMetadata.get(sessionId);
      // Count pages in this session
      let pageCount = 0;
      for (const [, sid] of this.state.pageToSession) {
        if (sid === sessionId) pageCount++;
      }

      sessions.push({
        sessionId,
        name: metadata?.name,
        contextPath: metadata?.contextPath,
        createdAt: metadata?.createdAt ?? new Date(),
        pageCount,
      });
    }

    return sessions;
  }

  /**
   * Close a session and all its pages.
   */
  async closeSession(sessionId: string): Promise<void> {
    const context = this.state.sessions.get(sessionId);
    if (!context) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Close all pages belonging to this session
    const pageIdsToClose: string[] = [];
    for (const [pageId, sid] of this.state.pageToSession) {
      if (sid === sessionId) {
        pageIdsToClose.push(pageId);
      }
    }

    for (const pageId of pageIdsToClose) {
      const page = this.state.pages.get(pageId);
      if (page) {
        try {
          await page.close();
        } catch {
          // Page might already be closed
        }
      }
      this.state.pages.delete(pageId);
      this.state.pageMetadata.delete(pageId);
      this.state.pageToSession.delete(pageId);
    }

    // Update active page if it was in this session
    if (this.state.activePageId && pageIdsToClose.includes(this.state.activePageId)) {
      const remaining = Array.from(this.state.pages.keys());
      this.state.activePageId = remaining[0] ?? null;
    }

    // Close the context
    try {
      await context.close();
    } catch {
      // Ignore
    }

    this.state.sessions.delete(sessionId);
    this.state.sessionMetadata.delete(sessionId);

    // Update active session
    if (this.state.activeSessionId === sessionId) {
      const remainingSessions = Array.from(this.state.sessions.keys());
      this.state.activeSessionId = remainingSessions[0] ?? null;
    }
  }

  /**
   * Get the session ID for a given page.
   */
  getSessionForPage(pageId: string): string | undefined {
    return this.state.pageToSession.get(pageId);
  }

  /**
   * Get the active session ID.
   */
  getActiveSessionId(): string | null {
    return this.state.activeSessionId;
  }

  /**
   * Set the active session.
   */
  setActiveSession(sessionId: string): void {
    if (!this.state.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }
    this.state.activeSessionId = sessionId;
  }

  // --- Page management ---

  /**
   * Ensure a default session exists, creating one if needed.
   */
  private async ensureDefaultSession(): Promise<string> {
    if (this.state.activeSessionId && this.state.sessions.has(this.state.activeSessionId)) {
      return this.state.activeSessionId;
    }

    // No active session — create a default one
    const sessionId = await this.createSession({ name: 'default' });
    return sessionId;
  }

  /**
   * Create a new page/tab within a session.
   */
  async createPage(url?: string, sessionId?: string): Promise<CreatePageResult> {
    this.ensureInitialized();

    // Resolve which session to use
    const targetSessionId = sessionId ?? await this.ensureDefaultSession();
    const context = this.state.sessions.get(targetSessionId);
    if (!context) {
      throw new Error(`Session ${targetSessionId} not found`);
    }

    const page = await context.newPage();
    const pageId = randomUUID();

    // Navigate if URL provided
    if (url) {
      await page.goto(url, {
        timeout: this.settings?.browser.timeout ?? 30000,
        waitUntil: 'load',
      });
    }

    // Store page and metadata
    this.state.pages.set(pageId, page);
    this.state.pageMetadata.set(pageId, {
      pageId,
      createdAt: new Date(),
      url: page.url(),
      title: await page.title(),
    });
    this.state.pageToSession.set(pageId, targetSessionId);

    // Set as active page
    this.state.activePageId = pageId;

    // Setup page close handler
    page.on('close', () => {
      this.state.pages.delete(pageId);
      this.state.pageMetadata.delete(pageId);
      this.state.pageToSession.delete(pageId);
      if (this.state.activePageId === pageId) {
        const remaining = Array.from(this.state.pages.keys());
        this.state.activePageId = remaining[0] ?? null;
      }
    });

    return {
      pageId,
      page,
      url: page.url(),
    };
  }

  /**
   * Get a page by ID.
   */
  getPage(pageId: string): Page | undefined {
    return this.state.pages.get(pageId);
  }

  /**
   * Get the active page.
   */
  getActivePage(): Page | undefined {
    if (!this.state.activePageId) return undefined;
    return this.state.pages.get(this.state.activePageId);
  }

  /**
   * Get the active page ID.
   */
  getActivePageId(): string | null {
    return this.state.activePageId;
  }

  /**
   * Set the active page.
   */
  setActivePage(pageId: string): void {
    if (!this.state.pages.has(pageId)) {
      throw new Error(`Page ${pageId} not found`);
    }
    this.state.activePageId = pageId;
  }

  /**
   * Close a page by ID.
   */
  async closePage(pageId: string): Promise<void> {
    const page = this.state.pages.get(pageId);
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    await page.close();
    // The 'close' event handler will clean up state
  }

  /**
   * List all pages.
   */
  async listPages(): Promise<PageInfo[]> {
    const pages: PageInfo[] = [];

    for (const [pageId, page] of this.state.pages) {
      try {
        pages.push({
          pageId,
          url: page.url(),
          title: await page.title(),
          isActive: pageId === this.state.activePageId,
          sessionId: this.state.pageToSession.get(pageId),
        });
      } catch {
        // Page might be closed, skip it
      }
    }

    return pages;
  }

  /**
   * Get page count.
   */
  getPageCount(): number {
    return this.state.pages.size;
  }

  /**
   * Shutdown the browser manager.
   */
  async shutdown(): Promise<void> {
    if (!this.state.browser) {
      return;
    }

    console.error('[camoufox-mcp] Shutting down browser...');

    // Close all sessions (which closes their pages and contexts)
    const sessionIds = Array.from(this.state.sessions.keys());
    for (const sessionId of sessionIds) {
      try {
        await this.closeSession(sessionId);
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Close browser
    try {
      await this.state.browser.close();
    } catch {
      // Ignore errors during cleanup
    }

    // Reset state
    this.state = {
      initialized: false,
      browser: null,
      pages: new Map(),
      activePageId: null,
      pageMetadata: new Map(),
      sessions: new Map(),
      sessionMetadata: new Map(),
      pageToSession: new Map(),
      activeSessionId: null,
    };

    console.error('[camoufox-mcp] Browser shutdown complete.');
  }

  /**
   * Ensure browser is initialized, throw if not.
   */
  private ensureInitialized(): void {
    if (!this.state.initialized || !this.state.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
  }
}

// Singleton instance for MCP server
export const browserManager = new BrowserManager();
