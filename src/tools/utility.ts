import { z } from 'zod';
import { browserManager } from '../browser/manager.js';
import { loadSettings, getDefaultConfigPath } from '../config/loader.js';

// Default popup/cookie consent selectors
const DEFAULT_POPUP_SELECTORS = [
  // Generic accept buttons
  'button[id*="accept"]',
  'button[class*="accept"]',
  'button[id*="agree"]',
  'button[class*="agree"]',
  'button[id*="consent"]',
  'button[class*="consent"]',
  'a[id*="accept"]',
  'a[class*="accept"]',

  // CookieBot
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',

  // OneTrust
  '#onetrust-accept-btn-handler',
  '.onetrust-close-btn-handler',

  // TrustArc
  '.trustarc-agree-btn',

  // Quantcast
  '.qc-cmp2-summary-buttons button[mode="primary"]',

  // Google consent
  'button[aria-label*="Accept"]',
  'button[aria-label*="Agree"]',

  // Generic patterns
  '[data-testid*="accept"]',
  '[data-testid*="cookie"]',
  '.cookie-accept',
  '.cookie-consent-accept',
  '#cookie-accept',
  '#accept-cookies',
];

// Input schemas
export const DismissPopupsInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  maxAttempts: z.number().default(3).describe('Maximum attempts to dismiss popups'),
  customSelectors: z.array(z.string()).optional().describe('Additional selectors to try'),
});

export const ReloadSettingsInputSchema = z.object({
  configPath: z.string().optional().describe('Path to settings.json file'),
});

export const GetPageTextInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  selector: z.string().optional().describe('CSS selector to extract text from (defaults to body)'),
});

// Tool implementations
export async function dismissPopups(input: z.infer<typeof DismissPopupsInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  const selectors = [...DEFAULT_POPUP_SELECTORS, ...(input.customSelectors ?? [])];
  const dismissed: string[] = [];
  let attempts = 0;

  while (attempts < input.maxAttempts) {
    let foundAny = false;

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click({ timeout: 1000 });
            dismissed.push(selector);
            foundAny = true;
            // Wait a bit for popup to close
            await page.waitForTimeout(500);
          }
        }
      } catch {
        // Element not found or not clickable, continue
      }
    }

    if (!foundAny) {
      break;
    }

    attempts++;
  }

  return {
    success: true,
    dismissed,
    attempts,
  };
}

export async function reloadSettings(input: z.infer<typeof ReloadSettingsInputSchema>) {
  const configPath = input.configPath ?? getDefaultConfigPath();

  try {
    const settings = loadSettings(configPath);
    return {
      success: true,
      settings,
      configPath,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      configPath,
    };
  }
}

export async function getPageText(input: z.infer<typeof GetPageTextInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  const selector = input.selector ?? 'body';

  try {
    const text = await page.$eval(selector, (el: Element) => {
      // Remove script and style content
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll('script, style, noscript').forEach((child: Element) => child.remove());
      return (clone as unknown as { innerText: string }).innerText?.trim() ?? '';
    });

    return {
      success: true,
      text,
      url: page.url(),
      title: await page.title(),
      length: text.length,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}
