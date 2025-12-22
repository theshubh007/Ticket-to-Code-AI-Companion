import React, { useState, useEffect, useCallback } from 'react';
import { postMessage } from './vscodeApi';
import {
  TicketData,
  TicketSummary,
  CodeChunk,
  ImplementationGuide,
  AISettings,
  FileDiff,
} from './types';
import { TicketPanel } from './components/TicketPanel/TicketPanel';
import { AnalysisPanel } from './components/AnalysisPanel/AnalysisPanel';
import { GuidePanel } from './components/GuidePanel/GuidePanel';
import { DiffViewer } from './components/DiffViewer/DiffViewer';

const OPENROUTER_CHAT_MODELS = new Set([
  '~anthropic/claude-haiku-latest',
  '~google/gemini-flash-latest',
]);

function normalizeOpenRouterChatModel(model: string): string {
  const trimmed = model.trim();
  return OPENROUTER_CHAT_MODELS.has(trimmed)
    ? trimmed
    : '~anthropic/claude-haiku-latest';
}

export type AppState = {
  aiChatModel: string;
  aiHasApiKey: boolean;
  aiSettingsLoading: boolean;
  aiSettingsError: string | null;
  aiSettingsStatus: string | null;

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
  pendingDiffs: FileDiff[] | null;
};

const initialState: AppState = {
  aiChatModel: '~anthropic/claude-haiku-latest',
  aiHasApiKey: false,
  aiSettingsLoading: true,
  aiSettingsError: null,
  aiSettingsStatus: null,

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
  pendingDiffs: null,
};

export function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [ticketSearch, setTicketSearch] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');

  const updateState = useCallback((partial: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Fetch assigned tickets automatically when the panel first opens
  useEffect(() => {
    postMessage('getAISettings');
    postMessage('listTickets');
  }, []);

  // Central message listener — all extension → UI messages land here
  useEffect(() => {
    const handler = (
      event: MessageEvent<{ command: string; payload?: unknown }>
    ) => {
      const { command, payload } = event.data;

      switch (command) {
        case 'aiSettings': {
          const settings = payload as AISettings;
          updateState({
            aiChatModel: normalizeOpenRouterChatModel(settings.chatModel),
            aiHasApiKey: settings.hasApiKey,
            aiSettingsLoading: false,
            aiSettingsError: null,
          });
          break;
        }

        case 'aiSettingsSaved':
          updateState({
            aiSettingsStatus: payload as string,
            aiSettingsError: null,
            aiSettingsLoading: false,
          });
          setApiKeyInput('');
          break;

        case 'aiSettingsError':
          updateState({
            aiSettingsError: payload as string,
            aiSettingsStatus: null,
            aiSettingsLoading: false,
          });
          break;

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
          const prog = payload as { step: number; total: number; stepTitle: string; phase: string; filePath?: string };
          const line =
            prog.phase === 'reading'
              ? `[${prog.step}/${prog.total}] Reading files for: ${prog.stepTitle}`
              : prog.phase === 'generating'
              ? `[${prog.step}/${prog.total}] Generating changes for: ${prog.stepTitle}`
              : `[${prog.step}/${prog.total}] Writing: ${prog.filePath ?? prog.stepTitle}`;
          setState((prev) => ({ ...prev, implementLog: [...prev.implementLog, line] }));
          break;
        }

        case 'diffResult':
          updateState({
            pendingDiffs: (payload as { diffs: FileDiff[] }).diffs,
            implementLoading: false,
          });
          break;

        case 'implementResult':
          updateState({
            implementResult: payload as { filesModified: string[] },
            implementLoading: false,
            pendingDiffs: null,
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

  function handleChatModelChange(model: string) {
    updateState({ aiChatModel: model, aiSettingsError: null, aiSettingsStatus: null });
  }

  function handleSaveAISettings() {
    updateState({ aiSettingsLoading: true, aiSettingsError: null, aiSettingsStatus: null });
    postMessage('saveAISettings', {
      chatModel: normalizeOpenRouterChatModel(state.aiChatModel),
      apiKey: apiKeyInput.trim() || undefined,
    });
  }

  function handleTicketSearchChange(value: string) {
    setTicketSearch(value);
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
    updateState({ implementLoading: true, implementLog: [], implementError: null, implementResult: null, pendingDiffs: null });
    postMessage('implement');
  }

  function handleAcceptDiff(index: number) {
    if (!state.pendingDiffs) return;
    const updated = state.pendingDiffs.filter((_, i) => i !== index);
    if (updated.length === 0) {
      postMessage('applyDiffs', { diffs: state.pendingDiffs });
    } else {
      updateState({ pendingDiffs: updated });
    }
  }

  function handleRejectDiff(index: number) {
    if (!state.pendingDiffs) return;
    const updated = state.pendingDiffs.filter((_, i) => i !== index);
    if (updated.length === 0) {
      updateState({ pendingDiffs: null });
    } else {
      updateState({ pendingDiffs: updated });
    }
  }

  function handleAcceptAll() {
    if (!state.pendingDiffs) return;
    postMessage('applyDiffs', { diffs: state.pendingDiffs });
    updateState({ pendingDiffs: null });
  }

  function handleCancelDiff() {
    updateState({ pendingDiffs: null });
  }

  function handleOpenFile(filePath: string, startLine: number, endLine: number) {
    postMessage('openFile', { filePath, startLine, endLine });
  }

  const normalizedSearch = ticketSearch.trim().toLowerCase();
  const filteredTicketList = (state.ticketList ?? []).filter((ticket) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      ticket.key.toLowerCase().includes(normalizedSearch) ||
      ticket.summary.toLowerCase().includes(normalizedSearch)
    );
  });

  if (state.pendingDiffs) {
    return (
      <div className="app">
        <DiffViewer
          diffs={state.pendingDiffs}
          onAcceptAll={handleAcceptAll}
          onCancel={handleCancelDiff}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <TicketPanel
        ticketList={filteredTicketList}
        totalTicketCount={state.ticketList?.length ?? 0}
        ticketSearch={ticketSearch}
        chatModel={state.aiChatModel}
        apiKeyInput={apiKeyInput}
        hasApiKey={state.aiHasApiKey}
        settingsLoading={state.aiSettingsLoading}
        settingsError={state.aiSettingsError}
        settingsStatus={state.aiSettingsStatus}
        ticketListLoading={state.ticketListLoading}
        ticketListError={state.ticketListError}
        ticket={state.ticket}
        error={state.ticketError}
        loading={state.ticketLoading}
        onTicketSearchChange={handleTicketSearchChange}
        onChatModelChange={handleChatModelChange}
        onApiKeyInputChange={setApiKeyInput}
        onSaveAISettings={handleSaveAISettings}
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