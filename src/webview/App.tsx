import React, { useState, useEffect, useCallback } from 'react';
import { postMessage } from './vscodeApi';
import { TicketData, CodeChunk, ImplementationGuide } from './types';
import { TicketPanel } from './components/TicketPanel/TicketPanel';
import { AnalysisPanel } from './components/AnalysisPanel/AnalysisPanel';
import { GuidePanel } from './components/GuidePanel/GuidePanel';

export type AppState = {
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
};

const initialState: AppState = {
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
};

export function App() {
  const [state, setState] = useState<AppState>(initialState);

  const updateState = useCallback((partial: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Central message listener — all extension → UI messages land here
  useEffect(() => {
    const handler = (
      event: MessageEvent<{ command: string; payload?: unknown }>
    ) => {
      const { command, payload } = event.data;

      switch (command) {
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
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [updateState]);

  function handleFetchTicket(key: string) {
    updateState({ ticketLoading: true, ticketError: null, ticket: null });
    postMessage('fetchTicket', { key });
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

  function handleOpenFile(filePath: string, startLine: number, endLine: number) {
    postMessage('openFile', { filePath, startLine, endLine });
  }

  return (
    <div className="app">
      <TicketPanel
        ticket={state.ticket}
        error={state.ticketError}
        loading={state.ticketLoading}
        onFetch={handleFetchTicket}
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
      />
    </div>
  );
}