import React from 'react';
import type { ProposalFile, TicketAgentStatus } from '../../../extension/types';
import { postMessage } from '../../vscodeApi';
import { Icon, IconName } from '../shared/Icon';
import { ActivityIndicator, Button, Disclosure, Note } from '../shared/ui';
import { ActivityList, AgentActivity, ChangeRequest, RevisionNotice } from './AgentActivity';
import { PullRequestSection } from './PullRequestSection';

const STEPS = ['Propose', 'Review', 'Apply', 'Test', 'PR'] as const;

/** Index of the current step, and whether the whole flow has finished. */
function stepState(agent: TicketAgentStatus | null): { current: number; complete: boolean } {
  switch (agent?.phase) {
    case 'running': return { current: agent.revising ? 1 : 0, complete: false };
    case 'review': return { current: 1, complete: false };
    case 'applying': return { current: 2, complete: false };
    case 'applied':
      if (agent.pr?.phase === 'created') return { current: 4, complete: true };
      return { current: agent.testResult?.outcome === 'passed' || agent.pr ? 4 : 3, complete: false };
    case 'testing': return { current: 3, complete: false };
    default: return { current: 0, complete: false };
  }
}

function Steps({ agent }: { agent: TicketAgentStatus | null }) {
  const { current, complete } = stepState(agent);
  const busy = agent?.phase === 'running' || agent?.phase === 'applying' || agent?.phase === 'testing' ||
    agent?.pr?.phase === 'drafting' || agent?.pr?.phase === 'creating';
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
  // With a fix on offer, the output stays one click away so the action stays in view.
  const exhausted = !!agent.repair && agent.repair.attempt >= agent.repair.max;
  return (
    <>
      <Note tone={tone} title={agent.message}>
        {result.command && <code className="command">{result.command}</code>}
      </Note>
      {result.output && (
        <Disclosure title="Test output" icon="list" defaultOpen={result.outcome === 'failed' && (!agent.canFix || exhausted)}>
          <pre className="console" aria-label="Test output" tabIndex={0}>{result.output}</pre>
        </Disclosure>
      )}
    </>
  );
}

/** After Apply: the applied files, the latest test result, and what to do about a failure. */
function AppliedBody({ agent }: { agent: TicketAgentStatus }) {
  const outcome = agent.testResult?.outcome;
  const canFix = outcome === 'failed' && agent.canFix;
  const repair = agent.repair;
  const exhausted = !!repair && repair.attempt >= repair.max;
  const runTests = () => postMessage('runTicketTests', { id: agent.id });
  const prOpen = !!agent.pr;
  return (
    <>
      <FileList agent={agent} interactive={false} />
      <RevisionNotice agent={agent} />
      <TestResult agent={agent} />
      {outcome === 'passed' && repair && (
        <p className="card-footnote">
          Passed after {repair.attempt} repair attempt{repair.attempt === 1 ? '' : 's'}.
        </p>
      )}
      {/* An open PR draft or result takes the lead; test actions step back. */}
      {prOpen && <PullRequestSection agent={agent} />}
      {canFix && !prOpen ? (
        <>
          {exhausted && (
            <p className="card-text">
              Tests still fail after {repair!.attempt} repair attempts. Check the output, or tell the agent what to try.
            </p>
          )}
          <ChangeRequest agent={agent} command="fixTicketTests" placeholder="Tell the agent what to try…" />
          <div className="stack">
            <Button variant="primary" block icon="wrench" onClick={() => postMessage('fixTicketTests', { id: agent.id })}>
              {exhausted ? 'Try another fix' : 'Fix failing tests'}
            </Button>
            <Button variant="secondary" block icon="play" onClick={runTests}>Run tests again</Button>
          </div>
          <PullRequestSection agent={agent} />
        </>
      ) : (
        <div className="stack">
          {!prOpen && outcome === 'passed' && <PullRequestSection agent={agent} />}
          {agent.pr?.phase !== 'creating' && agent.pr?.phase !== 'drafting' && (
            <Button variant={outcome === 'passed' || prOpen ? 'secondary' : 'primary'} block icon="play" onClick={runTests}>
              {agent.testResult ? 'Run tests again' : 'Run tests'}
            </Button>
          )}
          {!prOpen && outcome !== 'passed' && <PullRequestSection agent={agent} />}
        </div>
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
            <RevisionNotice agent={agent} />
            {agent?.message && <Note tone="info">{agent.message}</Note>}
            {agent?.canRevise ? (
              <ChangeRequest agent={agent} placeholder="Ask for a change, like “add a test anyway”" />
            ) : (
              <p className="card-text">
                The assistant reads the related code and tests, then proposes a fix with any missing tests.
                Nothing in your project changes until you apply it.
              </p>
            )}
            <Button variant={agent?.canRevise ? 'secondary' : 'primary'} block icon="sparkle" onClick={propose}>
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
            {!!agent!.steps?.length && <ActivityList steps={agent!.steps} live />}
            <Button variant="secondary" block onClick={() => postMessage('discardTicketChange', { id: agent!.id })}>
              {agent!.revising === 'repair' ? 'Stop repair' : agent!.revising ? 'Stop revising' : 'Cancel'}
            </Button>
          </>
        )}

        {phase === 'review' && (
          <>
            <RevisionNotice agent={agent} />
            {agent!.repair && (
              <p className="card-eyebrow">
                <Icon name="wrench" size={12} />
                Repair attempt {agent!.repair.attempt}{agent!.repair.attempt <= agent!.repair.max ? ` of ${agent!.repair.max}` : ''}
              </p>
            )}
            {agent!.coverage && <p className="card-text">{agent!.coverage}</p>}
            <FileList agent={agent!} interactive />
            <p className="card-footnote">Select a file to open its diff. Your files stay untouched until you apply.</p>
            {agent!.canRevise && <ChangeRequest agent={agent!} placeholder="Ask for changes…" />}
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

        {phase === 'applied' && <AppliedBody agent={agent!} />}

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

        {phase && phase !== 'running' && <AgentActivity steps={agent!.steps} defaultOpen={phase === 'error'} />}
      </div>
    </section>
  );
}
