import { z } from 'zod';
import { browserManager } from '../browser/manager.js';
import { getCurrentSnapshotVersion } from './snapshot.js';

// Input schemas
export const ClickInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  uid: z.string().describe('Element UID from snapshot to click'),
  button: z.enum(['left', 'right', 'middle']).default('left').describe('Mouse button'),
  clickCount: z.number().default(1).describe('Number of clicks (1 for single, 2 for double)'),
  modifiers: z.array(z.enum(['Alt', 'Control', 'Meta', 'Shift'])).optional().describe('Modifier keys to hold'),
});

export const HoverInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  uid: z.string().describe('Element UID from snapshot to hover over'),
});

export const FillInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  uid: z.string().describe('Element UID from snapshot (input, textarea, select)'),
  value: z.string().describe('Value to fill in'),
});

export const FillFormInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  fields: z.array(z.object({
    uid: z.string().describe('Element UID'),
    value: z.string().describe('Value to fill'),
  })).describe('List of fields to fill'),
});

export const PressKeyInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  key: z.string().describe('Key to press (e.g., "Enter", "Tab", "Control+a")'),
});

export const DragInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  fromUid: z.string().describe('Element UID to drag from'),
  toUid: z.string().describe('Element UID to drag to'),
});

// Validate that UID is from current snapshot version
function validateUid(uid: string): void {
  const parts = uid.split('_');
  if (parts.length !== 2) {
    throw new Error(`Invalid UID format: ${uid}. Expected format: version_index (e.g., "1_0").`);
  }

  const uidVersion = parseInt(parts[0], 10);
  const currentVersion = getCurrentSnapshotVersion();

  if (isNaN(uidVersion)) {
    throw new Error(`Invalid UID format: ${uid}. Version must be a number.`);
  }

  if (currentVersion === 0) {
    throw new Error('No snapshot taken yet. Call takeSnapshot first.');
  }

  if (uidVersion !== currentVersion) {
    throw new Error(
      `This UID (${uid}) is from a stale snapshot (version ${uidVersion}). ` +
      `Current snapshot version is ${currentVersion}. Take a new snapshot first.`
    );
  }
}

// Helper to get element by UID
async function getElementByUid(page: any, uid: string) {
  // Validate UID is from current snapshot
  validateUid(uid);

  const element = await page.$(`[data-mcp-uid="${uid}"]`);
  if (!element) {
    throw new Error(`Element with UID ${uid} not found. The element may have been removed from the DOM. Take a new snapshot.`);
  }
  return element;
}

// Helper to get page
function getPage(pageId?: string) {
  const page = pageId
    ? browserManager.getPage(pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(pageId ? `Page ${pageId} not found` : 'No active page');
  }
  return page;
}

// Tool implementations
export async function click(input: z.infer<typeof ClickInputSchema>) {
  const page = getPage(input.pageId);
  const element = await getElementByUid(page, input.uid);

  await element.click({
    button: input.button,
    clickCount: input.clickCount,
    modifiers: input.modifiers,
  });

  // Wait a bit for any navigation or state change
  await page.waitForTimeout(100);

  return {
    success: true,
    uid: input.uid,
    url: page.url(),
  };
}

export async function hover(input: z.infer<typeof HoverInputSchema>) {
  const page = getPage(input.pageId);
  const element = await getElementByUid(page, input.uid);

  await element.hover();

  return {
    success: true,
    uid: input.uid,
  };
}

export async function fill(input: z.infer<typeof FillInputSchema>) {
  const page = getPage(input.pageId);
  const element = await getElementByUid(page, input.uid);

  // Check if it's a select element
  const tagName = await element.evaluate((el: Element) => el.tagName.toLowerCase());

  if (tagName === 'select') {
    await element.selectOption(input.value);
  } else {
    // Clear existing value and type new one
    await element.fill(input.value);
  }

  return {
    success: true,
    uid: input.uid,
    value: input.value,
  };
}

export async function fillForm(input: z.infer<typeof FillFormInputSchema>) {
  const page = getPage(input.pageId);
  const results: Array<{ uid: string; success: boolean; error?: string }> = [];

  for (const field of input.fields) {
    try {
      const element = await getElementByUid(page, field.uid);
      const tagName = await element.evaluate((el: Element) => el.tagName.toLowerCase());

      if (tagName === 'select') {
        await element.selectOption(field.value);
      } else {
        await element.fill(field.value);
      }

      results.push({ uid: field.uid, success: true });
    } catch (error) {
      results.push({ uid: field.uid, success: false, error: String(error) });
    }
  }

  return {
    success: results.every((r) => r.success),
    results,
  };
}

export async function pressKey(input: z.infer<typeof PressKeyInputSchema>) {
  const page = getPage(input.pageId);

  await page.keyboard.press(input.key);

  return {
    success: true,
    key: input.key,
  };
}

export async function drag(input: z.infer<typeof DragInputSchema>) {
  const page = getPage(input.pageId);
  const fromElement = await getElementByUid(page, input.fromUid);
  const toElement = await getElementByUid(page, input.toUid);

  // Get bounding boxes
  const fromBox = await fromElement.boundingBox();
  const toBox = await toElement.boundingBox();

  if (!fromBox || !toBox) {
    throw new Error('Could not get element positions for drag');
  }

  // Perform drag
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 });
  await page.mouse.up();

  return {
    success: true,
    fromUid: input.fromUid,
    toUid: input.toUid,
  };
}
