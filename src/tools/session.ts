import { z } from 'zod';
import { browserManager } from '../browser/manager.js';
import { saveContextToFile } from '../browser/context.js';

// Input schemas
export const CreateSessionInputSchema = z.object({
  name: z.string().optional().describe('Human-readable name for the session'),
  contextPath: z.string().optional().describe('Path to a browser context JSON file to pre-load'),
});

export const ListSessionsInputSchema = z.object({});

export const SaveSessionInputSchema = z.object({
  sessionId: z.string().describe('The session ID to save'),
  outputPath: z.string().describe('File path to write the session state JSON'),
});

export const CloseSessionInputSchema = z.object({
  sessionId: z.string().describe('The session ID to close'),
});

export const ListContextFilesInputSchema = z.object({});

// Tool implementations
export async function createSession(input: z.infer<typeof CreateSessionInputSchema>) {
  const sessionId = await browserManager.createSession({
    name: input.name,
    contextPath: input.contextPath,
  });

  return {
    sessionId,
    message: `Created session${input.name ? ` "${input.name}"` : ''}${input.contextPath ? ` with context from ${input.contextPath}` : ''}`,
  };
}

export async function listSessions() {
  const sessions = browserManager.listSessions();
  return {
    sessions: sessions.map(s => ({
      sessionId: s.sessionId,
      name: s.name,
      contextPath: s.contextPath,
      createdAt: s.createdAt.toISOString(),
      pageCount: s.pageCount,
    })),
    activeSessionId: browserManager.getActiveSessionId(),
    count: sessions.length,
  };
}

export async function saveSession(input: z.infer<typeof SaveSessionInputSchema>) {
  const context = browserManager.getSession(input.sessionId);
  if (!context) {
    throw new Error(`Session ${input.sessionId} not found`);
  }

  const result = await saveContextToFile(context, input.outputPath);
  return {
    sessionId: input.sessionId,
    outputPath: result.outputPath,
    cookiesSaved: result.cookieCount,
    originsSaved: result.originCount,
    message: `Saved session state to ${result.outputPath}`,
  };
}

export async function closeSession(input: z.infer<typeof CloseSessionInputSchema>) {
  await browserManager.closeSession(input.sessionId);
  return {
    sessionId: input.sessionId,
    message: `Session ${input.sessionId} closed`,
  };
}

export async function listContextFiles() {
  const paths = browserManager.getRegisteredContextPaths();
  return {
    contextPaths: paths,
    count: paths.length,
    message: paths.length > 0
      ? `${paths.length} context file(s) registered. Use create_session with a contextPath to load one.`
      : 'No context files registered in settings.',
  };
}
