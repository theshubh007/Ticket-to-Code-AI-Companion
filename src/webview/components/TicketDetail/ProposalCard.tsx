import React from 'react';
import type { ProposalFile, TicketAgentStatus } from '../../../extension/types';
import { postMessage } from '../../vscodeApi';
import { Icon, IconName } from '../shared/Icon';
import { ActivityIndicator, Button, Disclosure, Note } from '../shared/ui';

const STEPS = ['Propose', 'Review', 'Apply', 'Test'] as const;

/** Index of the current step, and whether the whole flow has finished. */
function stepState(agent: TicketAgentStatus | null): { current: number; complete: boolean } {
  switch (agent?.phase) {
    case 'review': return { current: 1, complete: false };
    case 'applying': return { current: 2, complete: false };
    case 'applied': return { current: 3, complete: agent.testResult?.outcome === 'passed' };
    case 'testing': return { current: 3, complete: false };
    default: return { current: 0, complete: false };
  }
}

function Steps({ agent }: { agent: TicketAgentStatus | null }) {
  const { current, complete } = stepState(agent);
  const busy = agent?.phase === 'running' || agent?.phase === 'applying' || agent?.phase === 'testing';
  return (
    <ol className={`steps${busy ? ' steps--busy' : ''}`} aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = complete || i < current;
        const state = done ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li
            key={label}
            className={`step step--${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
            aria-label={`${label}${done ? ', done' : ''}`}
          >
            <span className="step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

const PURPOSE: Record<ProposalFile['purpose'], { label: string; icon: IconName }> = {
  fix: { label: 'Fix', icon: 'fileCode' },
  test: { label: 'Test', icon: 'flask' },
  setup: { label: 'Setup', icon: 'wrench' },
};

function splitPath(filePath: string) {
  const i = filePath.lastIndexOf('/');
  return i === -1 ? { name: filePath, dir: '' } : { name: filePath.slice(i + 1), dir: filePath.slice(0, i) };
}

function FileList({ agent, interactive }: { agent: TicketAgentStatus; interactive: boolean }) {
  if (!agent.files?.length) return null;
  return (
    <ul className="group group--nested" aria-label="Proposed files">
      {agent.files.map((file) => {
        const { name, dir } = splitPath(file.filePath);
        const purpose = PURPOSE[file.purpose];
        const content = (
          <>
            <span className={`file-icon file-icon--${file.purpose}`}><Icon name={purpose.icon} size={14} /></span>
            <span className="file-row-text">
              <span className="file-row-name">{name}</span>
              <span className="file-row-sub">
                <span className="file-row-role">{file.isNew ? `New ${purpose.label.toLowerCase()}` : purpose.label}</span>
                {dir && <><span aria-hidden="true">·</span><span className="file-row-dir">{dir}</span></>}
              </span>
            </span>
            {interactive && <Icon name="chevronRight" size={14} className="row-chevron" />}
          </>
        );
        return (
          <li key={file.filePath}>
            {interactive ? (
              <button
                type="button"
                className="file-row"
                title={`Show the diff for ${file.filePath}`}
                onClick={() => postMessage('reviewTicketChange', { id: agent.id, filePath: file.filePath })}
              >
                {content}
              </button>
            ) : (
              <div className="file-row" title={file.filePath}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TestResult({ agent }: { agent: TicketAgentStatus }) {
  const result = agent.testResult;
  if (!result) {
    return <Note tone="info">{agent.message}</Note>;
  }
  const tone = result.outcome === 'passed' ? 'success' : result.outcome === 'failed' ? 'error' : 'warning';
  return (
    <>
      <Note tone={tone} title={agent.message}>
        {result.command && <code className="command">{result.command}</code>}
      </Note>
      {result.output && (
        <Disclosure title="Test output" icon="list" defaultOpen={result.outcome === 'failed'}>
          <pre className="console" aria-label="Test output" tabIndex={0}>{result.output}</pre>
        </Disclosure>
      )}
    </>
  );
}

export function ProposalCard({ ticketKey, agent }: { ticketKey: string; agent: TicketAgentStatus | null }) {
  const phase = agent?.phase;
  const propose = () => postMessage('previewTicket', { key: ticketKey });

  return (
    <section className="card proposal" aria-labelledby="proposal-title">
      <div className="card-header">
        <span className="card-header-icon"><Icon name="sparkle" size={14} /></span>
        <h2 id="proposal-title">Fix and tests</h2>
      </div>
      <Steps agent={agent} />

      <div className="card-body" aria-live="polite">
        {(!agent || phase === 'done') && (
          <>
            {agent?.message && <Note tone="info">{agent.message}</Note>}
            <p className="card-text">
              The assistant reads the related code and tests, then proposes a fix with any missing tests.
              Nothing in your project changes until you apply it.
            </p>
            <Button variant="primary" block icon="sparkle" onClick={propose}>
              {agent ? 'Propose again' : 'Propose fix and tests'}
            </Button>
          </>
        )}

        {phase === 'running' && (
          <>
            <p className="card-status card-status--busy">
              <ActivityIndicator size={12} />
              <span>{agent!.message || 'Starting…'}</span>
            </p>
            <Button variant="secondary" block onClick={() => postMessage('discardTicketChange', { id: agent!.id })}>
              Cancel
            </Button>
          </>
        )}

        {phase === 'review' && (
          <>
            {agent!.coverage && <p className="card-text">{agent!.coverage}</p>}
            <FileList agent={agent!} interactive />
            <p className="card-footnote">Select a file to open its diff. Your files stay untouched until you apply.</p>
            <div className="stack">
              <Button variant="primary" block icon="check" onClick={() => postMessage('applyTicketChange', { id: agent!.id })}>
                Apply {agent!.files?.length === 1 ? 'change' : `${agent!.files?.length ?? ''} changes`}
              </Button>
              <Button variant="secondary" block onClick={() => postMessage('discardTicketChange', { id: agent!.id })}>
                Discard
              </Button>
            </div>
          </>
        )}

        {phase === 'applying' && (
          <>
            <p className="card-status card-status--busy">
              <ActivityIndicator size={12} />
              <span>{agent!.message}</span>
            </p>
          </>
        )}

        {phase === 'applied' && (
          <>
            <FileList agent={agent!} interactive={false} />
            <TestResult agent={agent!} />
            <Button
              variant={agent!.testResult?.outcome === 'passed' ? 'secondary' : 'primary'}
              block
              icon="play"
              onClick={() => postMessage('runTicketTests', { id: agent!.id })}
            >
              {agent!.testResult ? 'Run tests again' : 'Run tests'}
            </Button>
          </>
        )}

        {phase === 'testing' && (
          <>
            <p className="card-status card-status--busy">
              <ActivityIndicator size={12} />
              <span>{agent!.message}</span>
            </p>
            <Button variant="secondary" block icon="stop" onClick={() => postMessage('stopTicketTests', { id: agent!.id })}>
              Stop
            </Button>
          </>
        )}

        {phase === 'error' && (
          <>
            <Note tone="error" title="The proposal couldn't be completed">{agent!.message}</Note>
            <Button variant="primary" block icon="refresh" onClick={propose}>Try again</Button>
          </>
        )}

        {agent?.existingTest && (phase === 'review' || phase === 'done') && (
          <Button variant="plain" size="small" icon="flask" onClick={() => postMessage('openFile', agent.existingTest)}>
            Open existing test in {splitPath(agent.existingTest.filePath).name}
          </Button>
        )}
      </div>
    </section>
  );
}
