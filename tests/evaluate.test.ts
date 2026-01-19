import { describe, it, expect } from 'vitest';

// Test async pattern detection (isolated from browser)
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

function hasAsyncPatterns(script: string): { hasAsync: boolean; patterns: string[] } {
  const matched = ASYNC_PATTERNS.filter((p) => p.test(script));
  return {
    hasAsync: matched.length > 0,
    patterns: matched.map((p) => p.source),
  };
}

describe('Async Pattern Detection', () => {
  it('should detect async keyword', () => {
    const result = hasAsyncPatterns('async function foo() {}');
    expect(result.hasAsync).toBe(true);
    expect(result.patterns).toContain('\\basync\\b');
  });

  it('should detect await keyword', () => {
    const result = hasAsyncPatterns('const x = await fetch()');
    expect(result.hasAsync).toBe(true);
    expect(result.patterns).toContain('\\bawait\\b');
  });

  it('should detect .then()', () => {
    const result = hasAsyncPatterns('promise.then(x => x)');
    expect(result.hasAsync).toBe(true);
    expect(result.patterns).toContain('\\.then\\s*\\(');
  });

  it('should detect .catch()', () => {
    const result = hasAsyncPatterns('promise.catch(e => console.log(e))');
    expect(result.hasAsync).toBe(true);
  });

  it('should detect fetch()', () => {
    const result = hasAsyncPatterns('fetch("/api/data")');
    expect(result.hasAsync).toBe(true);
  });

  it('should detect new Promise', () => {
    const result = hasAsyncPatterns('new Promise((resolve) => resolve())');
    expect(result.hasAsync).toBe(true);
  });

  it('should detect Promise.all', () => {
    const result = hasAsyncPatterns('Promise.all([p1, p2])');
    expect(result.hasAsync).toBe(true);
  });

  it('should detect Promise.race', () => {
    const result = hasAsyncPatterns('Promise.race([p1, p2])');
    expect(result.hasAsync).toBe(true);
  });

  it('should NOT detect sync code', () => {
    const syncScripts = [
      'window.__NUXT__',
      'document.title',
      'const x = 1 + 2',
      'function foo() { return 42; }',
      '(() => { return window.data; })()',
    ];

    for (const script of syncScripts) {
      const result = hasAsyncPatterns(script);
      expect(result.hasAsync).toBe(false);
    }
  });

  it('should detect multiple async patterns', () => {
    const result = hasAsyncPatterns('async () => { await fetch("/api").then(r => r.json()) }');
    expect(result.hasAsync).toBe(true);
    expect(result.patterns.length).toBeGreaterThan(1);
  });
});
