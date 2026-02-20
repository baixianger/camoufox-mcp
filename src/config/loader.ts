import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { Settings, SettingsSchema } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Config paths in order of priority:
// 1. Environment variable: CAMOUFOX_MCP_CONFIG
// 2. User config: ~/.config/camoufox-mcp/settings.json
// 3. Package default: ./config/settings.json
const USER_CONFIG_DIR = join(homedir(), '.config', 'camoufox-mcp');
const USER_CONFIG_PATH = join(USER_CONFIG_DIR, 'settings.json');
const PACKAGE_CONFIG_PATH = join(__dirname, '../../config/settings.json');

type ConfigSource = 'env' | 'user' | 'package';

/**
 * Get the config path to use, in order of priority:
 * 1. CAMOUFOX_MCP_CONFIG env var
 * 2. User config (~/.config/camoufox-mcp/settings.json)
 * 3. Package default (./config/settings.json)
 */
function getConfigPath(): { path: string; source: ConfigSource } {
  // Check environment variable first
  const envConfig = process.env.CAMOUFOX_MCP_CONFIG;
  if (envConfig && existsSync(envConfig)) {
    return { path: envConfig, source: 'env' };
  }

  // Check user config directory
  if (existsSync(USER_CONFIG_PATH)) {
    return { path: USER_CONFIG_PATH, source: 'user' };
  }

  // Fall back to package default
  return { path: PACKAGE_CONFIG_PATH, source: 'package' };
}

// Default config path and source
const { path: DEFAULT_CONFIG_PATH, source: CONFIG_SOURCE } = getConfigPath();

/**
 * Substitute environment variables in a value.
 * Supports ${VAR_NAME} syntax.
 */
function substituteEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? '');
  }
  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVars);
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, substituteEnvVars(v)])
    );
  }
  return obj;
}

/**
 * Load settings from JSON file with environment variable substitution.
 */
export function loadSettings(configPath?: string): Settings {
  const path = configPath ?? DEFAULT_CONFIG_PATH;
  const source = configPath ? 'custom' : CONFIG_SOURCE;

  if (!existsSync(path)) {
    console.error(`[camoufox-mcp] Config not found at ${path}, using defaults`);
    return SettingsSchema.parse({});
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const substituted = substituteEnvVars(raw);
    const settings = SettingsSchema.parse(substituted);

    // Resolve relative contextPaths against the settings file's directory
    const configDir = dirname(resolve(path));
    settings.contextPaths = settings.contextPaths.map(cp =>
      isAbsolute(cp) ? cp : resolve(configDir, cp)
    );

    // Log which config is being used
    const sourceLabels = {
      env: 'environment variable',
      user: 'user config',
      package: 'package default',
      custom: 'custom path',
    };
    console.error(`[camoufox-mcp] Using ${sourceLabels[source]}: ${path}`);

    return settings;
  } catch (error) {
    console.error(`[camoufox-mcp] Error loading config: ${error}`);
    return SettingsSchema.parse({});
  }
}

/**
 * Save settings to JSON file.
 */
export function saveSettings(settings: Settings, configPath?: string): void {
  const path = configPath ?? DEFAULT_CONFIG_PATH;
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Get the default config path.
 */
export function getDefaultConfigPath(): string {
  return DEFAULT_CONFIG_PATH;
}

/**
 * Get the user config directory path.
 */
export function getUserConfigDir(): string {
  return USER_CONFIG_DIR;
}

/**
 * Get the user config file path.
 */
export function getUserConfigPath(): string {
  return USER_CONFIG_PATH;
}

/**
 * Initialize user config directory and create default settings if not exists.
 * Returns the path to the user config file.
 */
export function initUserConfig(): string {
  // Create config directory if it doesn't exist
  if (!existsSync(USER_CONFIG_DIR)) {
    mkdirSync(USER_CONFIG_DIR, { recursive: true });
  }

  // Create default settings file if it doesn't exist
  if (!existsSync(USER_CONFIG_PATH)) {
    const defaultSettings = SettingsSchema.parse({});
    writeFileSync(USER_CONFIG_PATH, JSON.stringify(defaultSettings, null, 2), 'utf-8');
    console.error(`[camoufox-mcp] Created default config at: ${USER_CONFIG_PATH}`);
  }

  return USER_CONFIG_PATH;
}

/**
 * Get all config paths for debugging.
 */
export function getConfigPaths(): {
  env?: string;
  user: string;
  package: string;
  active: string;
  source: ConfigSource;
} {
  return {
    env: process.env.CAMOUFOX_MCP_CONFIG,
    user: USER_CONFIG_PATH,
    package: PACKAGE_CONFIG_PATH,
    active: DEFAULT_CONFIG_PATH,
    source: CONFIG_SOURCE,
  };
}
