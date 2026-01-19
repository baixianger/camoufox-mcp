import { describe, it, expect } from 'vitest';
import { SettingsSchema, BrowserSettingsSchema, ProxySettingsSchema } from '../src/config/types.js';

describe('Settings Schema', () => {
  it('should parse empty object with defaults', () => {
    const result = SettingsSchema.parse({});

    expect(result.browser.headless).toBe(false);
    expect(result.browser.viewport).toEqual([1280, 1080]);
    expect(result.browser.timeout).toBe(30000);
    expect(result.browser.humanize).toBe(0.5);
    expect(result.browser.enableCache).toBe(true);
    expect(result.proxy.enabled).toBe(false);
    expect(result.popupSelectors).toEqual([]);
  });

  it('should parse custom browser settings', () => {
    const result = SettingsSchema.parse({
      browser: {
        headless: true,
        viewport: [1920, 1080],
        timeout: 60000,
        humanize: 1.0,
      },
    });

    expect(result.browser.headless).toBe(true);
    expect(result.browser.viewport).toEqual([1920, 1080]);
    expect(result.browser.timeout).toBe(60000);
    expect(result.browser.humanize).toBe(1.0);
  });

  it('should parse proxy settings', () => {
    const result = SettingsSchema.parse({
      proxy: {
        enabled: true,
        server: 'http://proxy.example.com:8080',
        username: 'user',
        password: 'pass',
        geoip: true,
      },
    });

    expect(result.proxy.enabled).toBe(true);
    expect(result.proxy.server).toBe('http://proxy.example.com:8080');
    expect(result.proxy.username).toBe('user');
    expect(result.proxy.password).toBe('pass');
    expect(result.proxy.geoip).toBe(true);
  });

  it('should parse custom popup selectors', () => {
    const result = SettingsSchema.parse({
      popupSelectors: ['#custom-popup', '.my-consent-btn'],
    });

    expect(result.popupSelectors).toEqual(['#custom-popup', '.my-consent-btn']);
  });
});

describe('Browser Settings Schema', () => {
  it('should accept boolean humanize', () => {
    const result = BrowserSettingsSchema.parse({ humanize: false });
    expect(result.humanize).toBe(false);
  });

  it('should accept numeric humanize', () => {
    const result = BrowserSettingsSchema.parse({ humanize: 2.5 });
    expect(result.humanize).toBe(2.5);
  });
});

describe('Proxy Settings Schema', () => {
  it('should default to disabled', () => {
    const result = ProxySettingsSchema.parse({});
    expect(result.enabled).toBe(false);
    expect(result.server).toBe('');
  });
});
