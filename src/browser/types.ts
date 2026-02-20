import type { Browser, Page, BrowserContext } from 'playwright-core';

/**
 * Metadata stored for each page/tab.
 */
export interface PageMetadata {
  pageId: string;
  createdAt: Date;
  url: string;
  title: string;
}

/**
 * Result of creating a new page.
 */
export interface CreatePageResult {
  pageId: string;
  page: Page;
  url: string;
}

/**
 * Page info returned to MCP clients.
 */
export interface PageInfo {
  pageId: string;
  url: string;
  title: string;
  isActive: boolean;
  sessionId?: string;
}

/**
 * Session info returned to MCP clients.
 */
export interface SessionInfo {
  sessionId: string;
  name?: string;
  contextPath?: string;
  createdAt: Date;
  pageCount: number;
}

/**
 * Metadata stored for each session.
 */
export interface SessionMetadata {
  name?: string;
  contextPath?: string;
  createdAt: Date;
}

/**
 * Snapshot element with unique ID for interaction.
 */
export interface SnapshotElement {
  uid: string;
  role: string;
  name: string;
  description?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  focused?: boolean;
  children?: SnapshotElement[];
}

/**
 * Result of taking a snapshot.
 */
export interface SnapshotResult {
  elements: SnapshotElement[];
  url: string;
  title: string;
}

/**
 * Browser manager state.
 */
export interface BrowserState {
  initialized: boolean;
  browser: Browser | null;
  pages: Map<string, Page>;
  activePageId: string | null;
  pageMetadata: Map<string, PageMetadata>;
  sessions: Map<string, BrowserContext>;
  sessionMetadata: Map<string, SessionMetadata>;
  pageToSession: Map<string, string>;
  activeSessionId: string | null;
}

/**
 * Camoufox launch options subset we use.
 */
export interface CamoufoxLaunchOptions {
  headless?: boolean | 'virtual';
  main_world_eval?: boolean;
  humanize?: boolean | number;
  enable_cache?: boolean;
  window?: [number, number];
  geoip?: boolean | string;
  block_images?: boolean;
  block_webrtc?: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}
