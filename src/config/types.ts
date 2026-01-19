import { z } from 'zod';

export const BrowserSettingsSchema = z.object({
  headless: z.boolean().default(false),
  viewport: z.tuple([z.number(), z.number()]).default([1280, 1080]),
  timeout: z.number().default(30000),
  humanize: z.union([z.boolean(), z.number()]).default(0.5),
  enableCache: z.boolean().default(true),
  blockImages: z.boolean().default(false),
  blockWebrtc: z.boolean().default(false),
});

export const ProxySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  server: z.string().default(''),
  username: z.string().default(''),
  password: z.string().default(''),
  geoip: z.boolean().default(true),
});

export const SettingsSchema = z.object({
  browser: BrowserSettingsSchema.default({}),
  proxy: ProxySettingsSchema.default({}),
  popupSelectors: z.array(z.string()).default([]),
});

export type BrowserSettings = z.infer<typeof BrowserSettingsSchema>;
export type ProxySettings = z.infer<typeof ProxySettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
