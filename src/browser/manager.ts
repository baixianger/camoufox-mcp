import type { Browser, Page, BrowserContext } from 'playwright-core';
import { randomUUID } from 'crypto';
import { ensureCamoufoxInstalled } from './installer.js';
import type { Settings } from '../config/types.js';
import type {
  BrowserState,
  PageInfo,
  PageMetadata,
  CreatePageResult,
} from './types.js';

/**
 * BrowserManager handles browser lifecycle and page management.
 * Provides a clean interface for MCP tools to interact with Camoufox.
 */
export class BrowserManager {
  private state: BrowserState = {
    initialized: false,
    browser: null,
    pages: new Map(),
    activePageId: null,
    pageMetadata: new Map(),
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
    this.state.browser = await Camoufox(launchOptions as any);
    this.state.initialized = true;
    console.error('[camoufox-mcp] Browser ready.');
  }

  /**
   * Check if the browser is initialized.
   */
  isInitialized(): boolean {
    return this.state.initialized && this.state.browser !== null;
  }

  /**
   * Create a new page/tab.
   */
  async createPage(url?: string): Promise<CreatePageResult> {
    this.ensureInitialized();

    const page = await this.state.browser!.newPage();
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

    // Set as active page
    this.state.activePageId = pageId;

    // Setup page close handler
    page.on('close', () => {
      this.state.pages.delete(pageId);
      this.state.pageMetadata.delete(pageId);
      if (this.state.activePageId === pageId) {
        // Set another page as active, or null if no pages left
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

    // Close all pages first
    for (const [pageId, page] of this.state.pages) {
      try {
        await page.close();
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
