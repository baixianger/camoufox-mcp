import { z } from 'zod';
import { browserManager } from '../browser/manager.js';

// Input schemas
export const TakeScreenshotInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID to screenshot. Uses active page if not specified.'),
  fullPage: z.boolean().default(false).describe('Capture full scrollable page instead of viewport'),
  uid: z.string().optional().describe('Element UID to screenshot (from snapshot)'),
  format: z.enum(['png', 'jpeg', 'webp']).default('png').describe('Image format'),
  quality: z.number().min(0).max(100).optional().describe('Quality for JPEG/WebP (0-100)'),
});

// Tool implementation
export async function takeScreenshot(input: z.infer<typeof TakeScreenshotInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  let screenshotBuffer: Buffer;

  // Playwright only supports png and jpeg, webp falls back to png
  const screenshotType = input.format === 'webp' ? 'png' : input.format;

  if (input.uid) {
    // Screenshot specific element by UID
    const element = await page.$(`[data-mcp-uid="${input.uid}"]`);
    if (!element) {
      throw new Error(`Element with UID ${input.uid} not found. Take a new snapshot first.`);
    }
    screenshotBuffer = await element.screenshot({
      type: screenshotType,
      quality: screenshotType === 'jpeg' ? input.quality : undefined,
    });
  } else {
    // Screenshot viewport or full page
    screenshotBuffer = await page.screenshot({
      type: screenshotType,
      fullPage: input.fullPage,
      quality: screenshotType === 'jpeg' ? input.quality : undefined,
    });
  }

  // Return as base64 for MCP image content
  const base64 = screenshotBuffer.toString('base64');
  const mimeType = `image/${input.format}`;

  return {
    data: base64,
    mimeType,
    url: page.url(),
    title: await page.title(),
  };
}
