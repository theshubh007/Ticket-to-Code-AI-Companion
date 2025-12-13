import React, { useState, useEffect, useCallback } from 'react';
import { postMessage, getState as vsGetState, setState as vsSetState } from './vscodeApi';
import { TicketData, TicketSummary, CodeChunk, ImplementationGuide } from './types';
import { TicketPanel } from './components/TicketPanel/TicketPanel';
import { AnalysisPanel } from './components/AnalysisPanel/AnalysisPanel';
import { GuidePanel } from './components/GuidePanel/GuidePanel';

export type AppState = {
  ticketList: TicketSummary[] | null;
  ticketListLoading: boolean;
  ticketListError: string | null;

  ticket: TicketData | null;
  ticketError: string | null;
  ticketLoading: boolean;

  chunks: CodeChunk[] | null;
  analysisError: string | null;
  analysisLoading: boolean;
  indexingProgress: { current: number; total: number } | null;

  guide: ImplementationGuide | null;
  guideError: string | null;
  guideLoading: boolean;

  implementLoading: boolean;
  implementLog: string[];
  implementResult: { filesModified: string[] } | null;
  implementError: string | null;
};

const initialState: AppState = {
  ticketList: null,
  ticketListLoading: true,
  ticketListError: null,
  ticket: null,
  ticketError: null,
  ticketLoading: false,
  chunks: null,
  analysisError: null,
  analysisLoading: false,
  indexingProgress: null,
  guide: null,
  guideError: null,
  guideLoading: false,

  implementLoading: false,
  implementLog: [],
  implementResult: null,
  implementError: null,
};

export function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = vsGetState<AppState>();
    if (!saved) return initialState;
    return {
      ...saved,
      // Reset all transient loading / error / progress state
      ticketListLoading: false,
      ticketListError: null,
      ticketLoading: false,
      ticketError: null,
      analysisLoading: false,
      analysisError: null,
      indexingProgress: null,
      guideLoading: false,
      guideError: null,
      implementLoading: false,
      implementError: null,
      // Clear session-only data — chunks hold embedding vectors that are no
      // longer in the extension host after a reload, and implement history is
      // stale. ticket + ticketList + guide are restored because the host also
      // rehydrates _lastTicket and _lastGuide from workspaceState.
      chunks: null,
      implementLog: [],
      implementResult: null,
    };
  });

  const updateState = useCallback((partial: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Persist state so it survives tab switches and extension host restarts
  useEffect(() => {
    vsSetState(state);
  }, [state]);

  // Fetch assigned tickets automatically when the panel first opens
  useEffect(() => {
    postMessage('listTickets');
  }, []);

  // Central message listener — all extension → UI messages land here
  useEffect(() => {
    const handler = (
      event: MessageEvent<{ command: string; payload?: unknown }>
    ) => {
      const { command, payload } = event.data;

      switch (command) {
        case 'ticketList':
          updateState({
            ticketList: payload as TicketSummary[],
            ticketListLoading: false,
            ticketListError: null,
          });
          break;

        case 'ticketListError':
          updateState({
            ticketListError: payload as string,
            ticketListLoading: false,
          });
          break;

        case 'ticketResult':
          updateState({
            ticket: payload as TicketData,
            ticketError: null,
            ticketLoading: false,
          });
          break;

        case 'ticketError':
          updateState({
            ticketError: payload as string,
            ticketLoading: false,
          });
          break;

        case 'analysisResult':
          updateState({
            chunks: payload as CodeChunk[],
            analysisError: null,
            analysisLoading: false,
            indexingProgress: null,
          });
          break;

        case 'analysisError':
          updateState({
            analysisError: payload as string,
            analysisLoading: false,
            indexingProgress: null,
          });
          break;

        case 'indexingProgress':
          updateState({
            indexingProgress: payload as { current: number; total: number },
          });
          break;

        case 'guideResult':
          updateState({
            guide: payload as ImplementationGuide,
            guideError: null,
            guideLoading: false,
          });
          break;

        case 'guideError':
          updateState({
            guideError: payload as string,
            guideLoading: false,
          });
          break;

        case 'implementProgress': {
          const p = payload as { step: number; total: number; stepTitle: string; phase: string; filePath?: string };
          const lines: string[] = [];
          if (p.phase === 'reading') {
            lines.push(`▸ Step ${p.step} / ${p.total}  ${p.stepTitle}`);
            lines.push('  Reading files…');
          } else if (p.phase === 'generating') {
            lines.push('  Generating patch…');
          } else if (p.phase === 'writing' && p.filePath) {
            lines.push(`  ✓ ${p.filePath}`);
          }
          setState((prev) => ({ ...prev, implementLog: [...prev.implementLog, ...lines] }));
          break;
        }

        case 'implementResult':
          updateState({
            implementResult: payload as { filesModified: string[] },
            implementLoading: false,
          });
          break;

        case 'implementError':
          updateState({
            implementError: payload as string,
            implementLoading: false,
          });
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [updateState]);

  function handleRetryList() {
    updateState({ ticketListLoading: true, ticketListError: null });
    postMessage('listTickets');
  }

  function handleFetchTicket(key: string) {
    updateState({ ticketLoading: true, ticketError: null, ticket: null });
    postMessage('fetchTicket', { key });
  }

  function handleClearTicket() {
    updateState({ ticket: null, ticketError: null });
  }

  function handleAnalyzeRepo() {
    updateState({
      analysisLoading: true,
      analysisError: null,
      chunks: null,
      indexingProgress: null,
    });
    postMessage('analyzeRepo', {
      ticketDescription: `${state.ticket?.summary ?? ''} ${state.ticket?.description ?? ''}`,
    });
  }

  function handleGenerateGuide() {
    updateState({ guideLoading: true, guideError: null, guide: null });
    postMessage('generateGuide');
  }

  function handleImplement() {
    updateState({
      implementLoading: true,
      implementError: null,
      implementLog: [],
      implementResult: null,
    });
    postMessage('implement');
  }

  function handleOpenFile(filePath: string, startLine: number, endLine: number) {
    postMessage('openFile', { filePath, startLine, endLine });
  }

  return (
    <div className="app">
      <TicketPanel
        ticketList={state.ticketList}
        ticketListLoading={state.ticketListLoading}
        ticketListError={state.ticketListError}
        ticket={state.ticket}
        error={state.ticketError}
        loading={state.ticketLoading}
        onFetch={handleFetchTicket}
        onClearTicket={handleClearTicket}
        onRetryList={handleRetryList}
      />
      <AnalysisPanel
        chunks={state.chunks}
        error={state.analysisError}
        loading={state.analysisLoading}
        progress={state.indexingProgress}
        disabled={!state.ticket}
        onAnalyze={handleAnalyzeRepo}
        onOpenFile={handleOpenFile}
      />
      <GuidePanel
        guide={state.guide}
        error={state.guideError}
        loading={state.guideLoading}
        disabled={!state.chunks}
        onGenerate={handleGenerateGuide}
        onOpenFile={handleOpenFile}
        implementLoading={state.implementLoading}
        implementLog={state.implementLog}
        implementResult={state.implementResult}
        implementError={state.implementError}
        onImplement={handleImplement}
      />
    </div>
  );
}