import { z } from 'zod';
import { browserManager } from '../browser/manager.js';
import type { Page } from 'playwright-core';

// Recording state per page
interface RecordingState {
  isRecording: boolean;
  actions: RecordedAction[];
  startTime: Date;
}

interface RecordedAction {
  type: 'click' | 'scroll' | 'input' | 'navigation';
  timestamp: number;
  x?: number;
  y?: number;
  text?: string;
  selector?: string;
  url?: string;
  value?: string;
}

const recordingStates = new Map<string, RecordingState>();

// Recorder script to inject into page
const RECORDER_SCRIPT = `
(() => {
  if (window.__mcpRecorder) return;

  window.__mcpRecorder = {
    actions: [],
    startTime: Date.now(),
  };

  // Click handler
  document.addEventListener('click', (e) => {
    const target = e.target;
    const action = {
      type: 'click',
      timestamp: Date.now() - window.__mcpRecorder.startTime,
      x: e.clientX,
      y: e.clientY,
      text: target.textContent?.trim().slice(0, 50) || undefined,
      selector: getSelector(target),
    };
    window.__mcpRecorder.actions.push(action);

    // Notify via callback if available
    if (window.__mcpRecordAction) {
      window.__mcpRecordAction(JSON.stringify(action));
    }
  }, true);

  // Scroll handler (debounced)
  let scrollTimeout;
  document.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const action = {
        type: 'scroll',
        timestamp: Date.now() - window.__mcpRecorder.startTime,
        x: window.scrollX,
        y: window.scrollY,
      };
      window.__mcpRecorder.actions.push(action);

      if (window.__mcpRecordAction) {
        window.__mcpRecordAction(JSON.stringify(action));
      }
    }, 200);
  }, true);

  // Input handler
  document.addEventListener('input', (e) => {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const action = {
        type: 'input',
        timestamp: Date.now() - window.__mcpRecorder.startTime,
        selector: getSelector(target),
        value: target.value?.slice(0, 100),
      };
      window.__mcpRecorder.actions.push(action);

      if (window.__mcpRecordAction) {
        window.__mcpRecordAction(JSON.stringify(action));
      }
    }
  }, true);

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    if (el.getAttribute('data-mcp-uid')) return '[data-mcp-uid="' + el.getAttribute('data-mcp-uid') + '"]';
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(' ').filter(c => c).slice(0, 2).join('.');
      if (classes) return el.tagName.toLowerCase() + '.' + classes;
    }
    return el.tagName.toLowerCase();
  }

  // Visual indicator
  const indicator = document.createElement('div');
  indicator.id = '__mcp-recording-indicator';
  indicator.innerHTML = '<span style="animation: blink 1s infinite;">●</span> Recording';
  indicator.style.cssText = 'position:fixed;top:10px;right:10px;background:red;color:white;padding:5px 10px;border-radius:4px;z-index:999999;font-family:sans-serif;font-size:12px;';
  document.body.appendChild(indicator);

  const style = document.createElement('style');
  style.textContent = '@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }';
  document.head.appendChild(style);
})()
`;

const STOP_RECORDER_SCRIPT = `
(() => {
  const indicator = document.getElementById('__mcp-recording-indicator');
  if (indicator) indicator.remove();

  const actions = window.__mcpRecorder?.actions || [];
  delete window.__mcpRecorder;
  return actions;
})()
`;

// Input schemas
export const StartRecordingInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
});

export const StopRecordingInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
});

export const GetRecordingStatusInputSchema = z.object({
  pageId: z.string().optional().describe('Page ID. Uses active page if not specified.'),
});

// Helper to get page and its ID
function getPageWithId(pageId?: string): { page: Page; id: string } {
  if (pageId) {
    const page = browserManager.getPage(pageId);
    if (!page) throw new Error(`Page ${pageId} not found`);
    return { page, id: pageId };
  }

  const activePage = browserManager.getActivePage();
  const activeId = browserManager.getActivePageId();
  if (!activePage || !activeId) throw new Error('No active page');
  return { page: activePage, id: activeId };
}

// Tool implementations
export async function startRecording(input: z.infer<typeof StartRecordingInputSchema>) {
  const { page, id } = getPageWithId(input.pageId);

  // Check if already recording
  const existingState = recordingStates.get(id);
  if (existingState?.isRecording) {
    return {
      success: false,
      error: 'Recording already in progress for this page',
    };
  }

  // Initialize recording state
  recordingStates.set(id, {
    isRecording: true,
    actions: [],
    startTime: new Date(),
  });

  // Expose callback function for real-time action capture
  try {
    await page.exposeFunction('__mcpRecordAction', (actionJson: string) => {
      const state = recordingStates.get(id);
      if (state?.isRecording) {
        try {
          const action = JSON.parse(actionJson) as RecordedAction;
          state.actions.push(action);
        } catch {
          // Ignore parse errors
        }
      }
    });
  } catch {
    // Function might already be exposed, ignore
  }

  // Inject recorder script
  await page.evaluate(RECORDER_SCRIPT);

  return {
    success: true,
    message: 'Recording started',
    pageId: id,
    startTime: recordingStates.get(id)?.startTime.toISOString(),
  };
}

export async function stopRecording(input: z.infer<typeof StopRecordingInputSchema>) {
  const { page, id } = getPageWithId(input.pageId);

  const state = recordingStates.get(id);
  if (!state?.isRecording) {
    return {
      success: false,
      error: 'No recording in progress for this page',
    };
  }

  // Get actions from page and stop recorder
  const pageActions = await page.evaluate(STOP_RECORDER_SCRIPT) as RecordedAction[];

  // Merge with any actions captured via callback
  const allActions = [...state.actions];

  // Add any page actions not already captured
  for (const action of pageActions) {
    const exists = allActions.some(
      (a) => a.timestamp === action.timestamp && a.type === action.type
    );
    if (!exists) {
      allActions.push(action);
    }
  }

  // Sort by timestamp
  allActions.sort((a, b) => a.timestamp - b.timestamp);

  // Clear recording state
  recordingStates.delete(id);

  return {
    success: true,
    message: 'Recording stopped',
    pageId: id,
    duration: Date.now() - state.startTime.getTime(),
    actionCount: allActions.length,
    actions: allActions,
  };
}

export async function getRecordingStatus(input: z.infer<typeof GetRecordingStatusInputSchema>) {
  const { id } = getPageWithId(input.pageId);

  const state = recordingStates.get(id);
  if (!state) {
    return {
      isRecording: false,
      pageId: id,
    };
  }

  return {
    isRecording: state.isRecording,
    pageId: id,
    startTime: state.startTime.toISOString(),
    duration: Date.now() - state.startTime.getTime(),
    actionCount: state.actions.length,
  };
}
