import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Get Camoufox installation directory based on platform.
 * Matches camoufox-js userCacheDir() function exactly:
 * - macOS: ~/Library/Caches/camoufox
 * - Linux: ~/.cache/camoufox
 * - Windows: ~/AppData/Local/camoufox/camoufox/Cache
 */
function getCamoufoxDir(): string {
  switch (process.platform) {
    case 'darwin':
      return join(homedir(), 'Library', 'Caches', 'camoufox');
    case 'win32':
      // camoufox-js uses: os.homedir(), "AppData", "Local", appName, appName, "Cache"
      return join(homedir(), 'AppData', 'Local', 'camoufox', 'camoufox', 'Cache');
    default:
      // Linux and other Unix-like
      return join(homedir(), '.cache', 'camoufox');
  }
}

/**
 * Get the expected executable path based on platform.
 * Matches camoufox-js LAUNCH_FILE:
 * - macOS: ../MacOS/camoufox (relative to Resources, so Camoufox.app/Contents/MacOS/camoufox)
 * - Linux: camoufox-bin
 * - Windows: camoufox.exe
 */
function getExecutablePath(): string {
  const dir = getCamoufoxDir();
  switch (process.platform) {
    case 'darwin':
      return join(dir, 'Camoufox.app', 'Contents', 'MacOS', 'camoufox');
    case 'win32':
      return join(dir, 'camoufox.exe');
    default:
      // Linux uses camoufox-bin, not camoufox
      return join(dir, 'camoufox-bin');
  }
}

/**
 * Check if Camoufox browser is installed.
 */
export function isCamoufoxInstalled(): boolean {
  const dir = getCamoufoxDir();

  // Check if directory exists and is not empty
  if (!existsSync(dir)) {
    return false;
  }

  try {
    const contents = readdirSync(dir);
    if (contents.length === 0) {
      return false;
    }
  } catch {
    return false;
  }

  // Check for executable
  const execPath = getExecutablePath();
  return existsSync(execPath);
}

/**
 * Download and install Camoufox browser.
 * Uses `npx camoufox-js fetch` command.
 */
export async function downloadCamoufox(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.error('[camoufox-mcp] Downloading Camoufox browser...');

    const proc = spawn('npx', ['camoufox-js', 'fetch'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      // Log progress to stderr (MCP convention for logging)
      process.stderr.write(`[camoufox-mcp] ${text}`);
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(`[camoufox-mcp] ${text}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.error('[camoufox-mcp] Camoufox browser installed successfully.');
        resolve();
      } else {
        reject(new Error(`Failed to download Camoufox (exit code ${code}): ${stderr || stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn npx: ${err.message}`));
    });
  });
}

/**
 * Ensure Camoufox is installed, downloading if necessary.
 * This is called automatically before launching the browser.
 */
export async function ensureCamoufoxInstalled(): Promise<void> {
  if (isCamoufoxInstalled()) {
    return;
  }

  console.error('[camoufox-mcp] Camoufox browser not found. Installing...');
  await downloadCamoufox();

  // Verify installation succeeded
  if (!isCamoufoxInstalled()) {
    throw new Error('Camoufox installation completed but browser not found');
  }
}
