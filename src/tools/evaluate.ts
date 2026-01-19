import { z } from 'zod';
import { browserManager } from '../browser/manager.js';

// Patterns that indicate async code
const ASYNC_PATTERNS = [
  /\basync\b/,
  /\bawait\b/,
  /\.then\s*\(/,
  /\.catch\s*\(/,
  /\.finally\s*\(/,
  /\bfetch\s*\(/,
  /new\s+Promise\b/,
  /Promise\.(all|race|any|allSettled|resolve|reject)\b/,
];

/**
 * Check if script contains async patterns.
 */
function hasAsyncPatterns(script: string): { hasAsync: boolean; patterns: string[] } {
  const matched = ASYNC_PATTERNS.filter((p) => p.test(script));
  return {
    hasAsync: matched.length > 0,
    patterns: matched.map((p) => p.source),
  };
}

// Input schemas
export const EvaluateMainworldInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  script: z.string().describe('JavaScript code to execute in main world. NO async/await support. Can access window globals like __NUXT__, __NEXT_DATA__, etc.'),
});

export const EvaluateIsolatedInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  script: z.string().describe('JavaScript code to execute in isolated context. Supports async/await. Cannot access page globals.'),
});

/**
 * Execute JavaScript in the main world context.
 * - Can access window globals (__NUXT__, __NEXT_DATA__, etc.)
 * - CANNOT use async/await/Promise
 * - Uses mw: prefix for Camoufox
 */
export async function evaluateMainworld(input: z.infer<typeof EvaluateMainworldInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  // Check for async patterns
  const asyncCheck = hasAsyncPatterns(input.script);
  if (asyncCheck.hasAsync) {
    return {
      success: false,
      error: 'Async patterns detected in script. Main world does not support async/await/Promise.',
      detectedPatterns: asyncCheck.patterns,
      suggestion: 'Use evaluate_isolated tool instead for async operations.',
    };
  }

  try {
    // Prefix with mw: for main world execution in Camoufox
    const result = await page.evaluate(`mw:${input.script}`);
    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Execute JavaScript in isolated context.
 * - Supports async/await/Promise
 * - CANNOT access window globals
 * - Standard Playwright evaluate
 */
export async function evaluateIsolated(input: z.infer<typeof EvaluateIsolatedInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  try {
    // Check if script contains await - if so, wrap in async IIFE
    const asyncCheck = hasAsyncPatterns(input.script);
    let script = input.script;

    if (asyncCheck.hasAsync) {
      // Wrap in async IIFE to support await
      script = `(async () => { return ${input.script}; })()`;
    }

    // No prefix = isolated world (standard Playwright behavior)
    const result = await page.evaluate(script);
    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Convenience tool to get framework state (Next.js, Nuxt, etc.)
 */
export const GetFrameworkStateInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
  framework: z.enum(['auto', 'nextjs', 'nuxt']).default('auto').describe('Framework to detect'),
});

export async function getFrameworkState(input: z.infer<typeof GetFrameworkStateInputSchema>) {
  const page = input.pageId
    ? browserManager.getPage(input.pageId)
    : browserManager.getActivePage();

  if (!page) {
    throw new Error(input.pageId ? `Page ${input.pageId} not found` : 'No active page');
  }

  const script = `
    (() => {
      const result = {
        framework: null,
        state: null,
      };

      // Check Next.js
      if (window.__NEXT_DATA__) {
        result.framework = 'nextjs';
        result.state = window.__NEXT_DATA__;
        return result;
      }

      // Check Nuxt 3
      if (window.__NUXT__) {
        result.framework = 'nuxt';
        result.state = window.__NUXT__;
        return result;
      }

      // Check Nuxt 2
      if (window.$nuxt && window.$nuxt.$store) {
        result.framework = 'nuxt2';
        result.state = window.$nuxt.$store.state;
        return result;
      }

      return result;
    })()
  `;

  try {
    const result = await page.evaluate(`mw:${script}`) as { framework: string | null; state: unknown };
    return {
      success: true,
      framework: result.framework,
      state: result.state,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}
