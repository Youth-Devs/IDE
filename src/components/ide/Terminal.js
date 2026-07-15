'use client';

import { useEffect, useRef, useState } from 'react';

const terminalTheme = {
  background: '#020617',
  foreground: '#d1d5db',
  cursor: '#34d399',
  cursorAccent: '#020617',
  selectionBackground: 'rgba(52, 211, 153, 0.25)',
  black: '#0f172a',
  red: '#f87171',
  green: '#34d399',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e5e7eb',
  brightBlack: '#475569',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f8fafc',
};

function getSocketStateLabel(state) {
  switch (state) {
    case 'connecting':
      return 'connecting';
    case 'open':
      return 'connected';
    case 'closed':
      return 'disconnected';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

export default function Terminal({ className = '', title = 'Remote Terminal', projectId, projectData }) {
  const containerRef = useRef(null);
  const terminalRef = useRef(null);
  const socketRef = useRef(null);
  const fitAddonRef = useRef(null);
  const dataDisposableRef = useRef(null);
  const pendingBufferRef = useRef('');
  const reconnectTimerRef = useRef(null);
  const disposedRef = useRef(false);
  const initAckReceivedRef = useRef(false);
  const lastBackendMessageRef = useRef('');
  const lastInitSummaryRef = useRef('');
  const [socketState, setSocketState] = useState('idle');
  const [statusText, setStatusText] = useState('Waiting for a WebSocket backend...');

  const focusTerminal = () => {
    try {
      containerRef.current?.focus?.();
    } catch {
      // Ignore focus failures during unmount/reconnect transitions.
    }

    try {
      terminalRef.current?.focus();
    } catch {
      // Ignore focus failures during unmount/reconnect transitions.
    }
  };

  useEffect(() => {
    const host = containerRef.current;
    const wsUrl = process.env.NEXT_PUBLIC_TERMINAL_WS_URL;

    if (!host) {
      return undefined;
    }

    disposedRef.current = false;
    pendingBufferRef.current = '';
    initAckReceivedRef.current = false;
    lastBackendMessageRef.current = '';
    lastInitSummaryRef.current = '';
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    let fitFrameId = 0;
    let fitTimeoutId = 0;
    let initFrameId = 0;
    let resizeObserver = null;
    let terminalStarted = false;

    const scheduleFit = () => {
      if (fitFrameId) {
        cancelAnimationFrame(fitFrameId);
      }

      fitFrameId = requestAnimationFrame(() => {
        fitFrameId = 0;

        if (disposedRef.current || !fitAddonRef.current || !terminalRef.current || !host?.isConnected) {
          return;
        }

        if (!host.clientWidth || !host.clientHeight) {
          return;
        }

        try {
          fitAddonRef.current.fit();
        } catch {
          // Ignore sizing errors during rapid resize/unmount transitions.
        }
      });
    };

    const initTerminal = async () => {
      const xtermModule = await import('xterm');

      if (disposedRef.current) {
        return;
      }

      const terminal = new xtermModule.Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        cursorWidth: 2,
        cursorInactiveStyle: 'outline',
        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 13,
        lineHeight: 1.35,
        letterSpacing: 0,
        scrollback: 4000,
        allowTransparency: true,
        convertEol: false,
        disableStdin: false,
        theme: terminalTheme,
      });

      host.replaceChildren();
      terminalRef.current = terminal;
      terminal.open(host);
      // Some shells hide the cursor while switching modes. Keep an explicit
      // xterm cursor visible so the input location is obvious immediately.
      terminal.write('\x1b[?25h');
      host.tabIndex = 0;
      host.setAttribute('role', 'application');
      host.setAttribute('aria-label', 'Remote terminal');
      host.style.outline = 'none';
      terminal.focus();

      // Keep the terminal focused on shell output; connection diagnostics stay in app state.
      const writeLine = () => {};

      try {
        const fitModule = await import('xterm-addon-fit');

        if (disposedRef.current) {
          return;
        }

        fitAddonRef.current = new fitModule.FitAddon();
        terminal.loadAddon(fitAddonRef.current);
        fitTimeoutId = window.setTimeout(() => scheduleFit(), 0);
      } catch (error) {
        writeLine(`[terminal] Fit addon failed to load: ${error?.message || error}`, '91');
      }

      if (!projectId) {
        setSocketState('idle');
        setStatusText('Select a project to connect the terminal.');
        writeLine('[terminal] waiting for a project selection...', '90');
        return;
      }

      if (!wsUrl) {
        setSocketState('error');
        setStatusText('Missing NEXT_PUBLIC_TERMINAL_WS_URL.');
        writeLine('[terminal] NEXT_PUBLIC_TERMINAL_WS_URL is not configured.', '91');
        writeLine('[terminal] Set the env var to connect this terminal to your backend.', '91');
        return;
      }

      let socket;

      try {
        setSocketState('connecting');
        setStatusText(`Connecting to ${wsUrl}`);
        writeLine(`[terminal] connecting to ${wsUrl} ...`, '94');

        socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        socket.binaryType = 'arraybuffer';
      } catch (error) {
        setSocketState('error');
        setStatusText('Failed to create WebSocket connection.');
        writeLine(`[terminal] websocket creation failed: ${error?.message || error}`, '91');
        return;
      }

      const flushPending = () => {
        if (!socket || socket.readyState !== WebSocket.OPEN || !pendingBufferRef.current) {
          return;
        }

        socket.send(pendingBufferRef.current);
        pendingBufferRef.current = '';
      };

      const encoder = new TextDecoder();

      socket.onopen = () => {
        if (disposedRef.current) {
          return;
        }

        setSocketState('open');
        setStatusText('Connected. Initializing project workspace...');
        writeLine('[terminal] connected.', '92');

        try {
          const initPayload = {
            type: 'init',
            projectId,
            projectSlug: projectData?.slug || null,
            projectName: projectData?.name || null,
            projectTemplate: projectData?.template || null,
            githubRepo: projectData?.githubRepo || null,
            githubOwner: projectData?.githubOwner || null,
            githubBranch: projectData?.githubBranch || null,
            files: Array.isArray(projectData?.files)
              ? projectData.files.map((file) => ({
                  id: file?.id || null,
                  name: file?.name || null,
                  language: file?.language || null,
                  content: typeof file?.content === 'string' ? file.content : '',
                }))
              : [],
          };
          lastInitSummaryRef.current = JSON.stringify({
            projectId: initPayload.projectId,
            projectSlug: initPayload.projectSlug,
            projectName: initPayload.projectName,
            projectTemplate: initPayload.projectTemplate,
            githubRepo: initPayload.githubRepo,
            fileCount: initPayload.files.length,
          });

          writeLine(`[terminal] init payload: ${lastInitSummaryRef.current}`, '96');
          socket.send(JSON.stringify(initPayload));
        } catch (error) {
          setSocketState('error');
          setStatusText('Failed to initialize the terminal session.');
          writeLine(`[terminal] init payload failed: ${error?.message || error}`, '91');
          try {
            socket.close();
          } catch {
            // Ignore close errors during initialization failure.
          }
          return;
        }

        setStatusText(`Connected to project ${projectId}.`);
        flushPending();
        terminal.write('\x1b[?25h');
        focusTerminal();

        dataDisposableRef.current = terminal.onData((data) => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(data);
            return;
          }

          pendingBufferRef.current += data;
        });
      };

      socket.onmessage = async (event) => {
        if (disposedRef.current) {
          return;
        }

        try {
          if (typeof event.data === 'string') {
            lastBackendMessageRef.current = event.data;

            try {
              const parsed = JSON.parse(event.data);
              if (parsed && typeof parsed === 'object') {
                if (parsed.type === 'ready' || parsed.type === 'initialized' || parsed.type === 'ok') {
                  initAckReceivedRef.current = true;
                  setStatusText(parsed.message || 'Workspace synced. Terminal ready.');
                  focusTerminal();
                  return;
                }

                if (parsed.type === 'error') {
                  const backendMessage = parsed.message || 'Backend reported an error.';
                  const backendDetails = parsed.details ? ` Details: ${JSON.stringify(parsed.details)}` : '';
                  setSocketState('error');
                  setStatusText(`Terminal backend issue: ${backendMessage}`);
                  writeLine(`[terminal] backend error: ${backendMessage}${backendDetails}`, '91');
                  return;
                }

                if (parsed.type === 'debug') {
                  writeLine(`[terminal] backend debug: ${JSON.stringify(parsed)}`, '90');
                  return;
                }
              }
            } catch {
              // Non-JSON terminal output is expected; just pass it through.
            }

            terminal.write(event.data);
            return;
          }

          if (event.data instanceof Blob) {
            const buffer = await event.data.arrayBuffer();
            terminal.write(encoder.decode(buffer));
            return;
          }

          if (event.data instanceof ArrayBuffer) {
            terminal.write(encoder.decode(event.data));
          }
        } catch (error) {
          writeLine(`[terminal] message decode failed: ${error?.message || error}`, '91');
        }
      };

      socket.onerror = () => {
        if (disposedRef.current) {
          return;
        }

        setSocketState('error');
        setStatusText('WebSocket error. This is likely a terminal backend issue.');
        writeLine('[terminal] websocket error. Likely backend issue or network interruption.', '91');
      };

      socket.onclose = (event) => {
        if (disposedRef.current) {
          return;
        }

        setSocketState('closed');
        const closeCode = event?.code ?? 'unknown';
        const closeReason = event?.reason ? ` ${event.reason}` : '';
        const likelyBackendIssue = closeCode === 1006 || (!initAckReceivedRef.current && !!lastBackendMessageRef.current);
        const backendHint = likelyBackendIssue ? ' Likely terminal backend issue.' : '';
        setStatusText(`WebSocket disconnected (${closeCode})${closeReason}${backendHint}`);
        writeLine(`[terminal] disconnected (${closeCode})${closeReason}`, '91');
        writeLine(`[terminal] backend hint: ${likelyBackendIssue ? 'backend likely failed during workspace sync' : 'connection closed normally'}`, '90');
        if (lastInitSummaryRef.current) {
          writeLine(`[terminal] last init summary: ${lastInitSummaryRef.current}`, '90');
        }
        if (lastBackendMessageRef.current) {
          writeLine(`[terminal] last backend message: ${lastBackendMessageRef.current}`, '90');
        }

        if (projectId && wsUrl) {
          reconnectTimerRef.current = setTimeout(() => {
            if (!disposedRef.current) {
              setSocketState('connecting');
              setStatusText(`Reconnecting to project ${projectId}...`);
            }
          }, 1500);
        }
      };

    };

    const startWhenSized = () => {
      initFrameId = 0;

      if (disposedRef.current || terminalStarted || !host.isConnected) {
        return;
      }

      if (!host.clientWidth || !host.clientHeight) {
        initFrameId = requestAnimationFrame(startWhenSized);
        return;
      }

      terminalStarted = true;
      initTerminal();
    };

    if (typeof ResizeObserver !== 'undefined' && host) {
      resizeObserver = new ResizeObserver(() => {
        startWhenSized();
        scheduleFit();
      });
      resizeObserver.observe(host);
    }

    startWhenSized();

    const handleResize = () => {
      scheduleFit();
    };

    const handleFocus = () => {
      terminalRef.current?.focus();
    };

    const isTextInputTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tagName = target.tagName;
      return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    };

    const encodeCtrlKey = (key) => {
      const lower = key.toLowerCase();
      if (lower.length !== 1 || lower < 'a' || lower > 'z') return null;
      return String.fromCharCode(lower.charCodeAt(0) - 96);
    };

    const handleGlobalKeyDown = (event) => {
      if (disposedRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      if (isTextInputTarget(event.target) && event.target !== containerRef.current) {
        return;
      }

      const socket = socketRef.current;
      let payload = null;

      if (event.ctrlKey && !event.altKey && !event.metaKey && event.key.length === 1) {
        payload = encodeCtrlKey(event.key);
      } else if (event.key === 'Enter') {
        payload = '\r';
      } else if (event.key === 'Backspace') {
        payload = '\x7f';
      } else if (event.key === 'Tab') {
        payload = '\t';
      } else if (event.key === 'Escape') {
        payload = '\x1b';
      } else if (event.key === 'ArrowUp') {
        payload = '\x1b[A';
      } else if (event.key === 'ArrowDown') {
        payload = '\x1b[B';
      } else if (event.key === 'ArrowRight') {
        payload = '\x1b[C';
      } else if (event.key === 'ArrowLeft') {
        payload = '\x1b[D';
      } else if (event.key === 'Home') {
        payload = '\x1b[H';
      } else if (event.key === 'End') {
        payload = '\x1b[F';
      } else if (event.key === 'Delete') {
        payload = '\x1b[3~';
      } else if (event.key === 'PageUp') {
        payload = '\x1b[5~';
      } else if (event.key === 'PageDown') {
        payload = '\x1b[6~';
      } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
        payload = event.altKey ? `\x1b${event.key}` : event.key;
      }

      if (!payload) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      focusTerminal();

      try {
        socket.send(payload);
      } catch {
        // Ignore transient send failures while reconnecting.
      }
    };

    window.addEventListener('resize', handleResize);
    host.addEventListener('mousedown', handleFocus);
    window.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
      disposedRef.current = true;

      window.removeEventListener('resize', handleResize);
      host.removeEventListener('mousedown', handleFocus);
      window.removeEventListener('keydown', handleGlobalKeyDown, true);

      if (fitFrameId) {
        cancelAnimationFrame(fitFrameId);
        fitFrameId = 0;
      }

      if (initFrameId) {
        cancelAnimationFrame(initFrameId);
        initFrameId = 0;
      }

      if (fitTimeoutId) {
        clearTimeout(fitTimeoutId);
        fitTimeoutId = 0;
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (dataDisposableRef.current) {
        dataDisposableRef.current.dispose();
        dataDisposableRef.current = null;
      }

      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // Ignore socket close failures during teardown.
        }
        socketRef.current = null;
      }

      if (terminalRef.current) {
        try {
          fitAddonRef.current?.dispose?.();
        } catch {
          // Ignore addon cleanup failures during rapid route changes.
        }
        fitAddonRef.current = null;

        try {
          terminalRef.current.dispose();
        } catch {
          // Ignore xterm cleanup failures during rapid route changes.
        }
        terminalRef.current = null;
      }

      pendingBufferRef.current = '';
    };
  }, [projectId]);

  return (
    <section
      className={[
        'flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#020617]',
        className,
      ].join(' ')}
    >
      <div className="relative flex-1 min-h-0 overflow-hidden bg-[#020617] p-2">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.82),rgba(2,6,23,0.98))]"
          aria-hidden="true"
        />
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#020617]/95 focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/90">{title}</span>
            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-400">
              <span className={[
                'h-1.5 w-1.5 rounded-full',
                socketState === 'open' ? 'bg-emerald-400' : socketState === 'connecting' ? 'bg-sky-400' : socketState === 'error' ? 'bg-rose-400' : 'bg-slate-500',
              ].join(' ')} />
              {getSocketStateLabel(socketState)}
            </span>
          </div>
          <div
            ref={containerRef}
            className="terminal-host min-h-0 flex-1 w-full cursor-text"
            tabIndex={0}
            onMouseDown={focusTerminal}
            onPointerDown={focusTerminal}
            onClick={focusTerminal}
            onFocus={focusTerminal}
            onKeyDown={focusTerminal}
          />
        </div>
      </div>
    </section>
  );
}
