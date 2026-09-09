import React, { useState } from 'react';
import type { PullRequestState, TicketAgentStatus } from '../../../extension/types';
import { postMessage } from '../../vscodeApi';
import { Icon } from '../shared/Icon';
import { ActivityIndicator, Button, Note } from '../shared/ui';

/** Draft PR controls after Apply: start, confirm the editable draft, then link to the result. */
export function PullRequestSection({ agent }: { agent: TicketAgentStatus }) {
  const pr = agent.pr;
  const id = agent.id;
  const outcome = agent.testResult?.outcome;

  if (!pr) {
    return (
      <>
        <Button variant={outcome === 'passed' ? 'primary' : 'secondary'} block icon="pullRequest"
          onClick={() => postMessage('draftTicketPR', { id })}>
          Create draft PR
        </Button>
        {outcome !== 'passed' && (
          <p className="card-footnote">
            {agent.testResult ? 'The tests haven’t passed yet.' : 'The tests haven’t run yet.'} The PR description will say so.
          </p>
        )}
      </>
    );
  }

  if (pr.phase === 'drafting') {
    return (
      <p className="card-status card-status--busy">
        <ActivityIndicator size={12} />
        <span>Writing the PR description…</span>
      </p>
    );
  }

  if (pr.phase === 'created') {
    return (
      <>
        <Note tone="success" title={`Draft PR #${pr.number} opened`}>
          <code className="command">{pr.draft?.branch} → {pr.draft?.base}</code>
        </Note>
        <Button variant="primary" block icon="external" onClick={() => postMessage('openTicketPR', { id })}>
          Open on GitHub
        </Button>
      </>
    );
  }

  if (!pr.draft) {
    return (
      <>
        <Note tone="error" title="Couldn’t prepare the draft PR">{pr.error}</Note>
        <div className="stack">
          <Button variant="secondary" block icon="refresh" onClick={() => postMessage('draftTicketPR', { id })}>Try again</Button>
          <Button variant="plain" block onClick={() => postMessage('cancelTicketPR', { id })}>Cancel</Button>
        </div>
      </>
    );
  }

  // Remount when a new draft arrives so the fields start from it.
  return <PullRequestForm key={pr.draft.branch} agent={agent} pr={pr as Required<Pick<PullRequestState, 'draft'>> & PullRequestState} />;
}

function PullRequestForm({ agent, pr }: { agent: TicketAgentStatus; pr: PullRequestState & Required<Pick<PullRequestState, 'draft'>> }) {
  const [title, setTitle] = useState(pr.draft.title);
  const [body, setBody] = useState(pr.draft.body);
  const creating = pr.phase === 'creating';
  const fileCount = agent.files?.length ?? 0;
  const titleId = `pr-title-${agent.id}`;
  const bodyId = `pr-body-${agent.id}`;

  return (
    <form
      className="pr-form"
      aria-label="Draft pull request"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) postMessage('createTicketPR', { id: agent.id, title, body });
      }}
    >
      <div className="pr-form-head">
        <span className="pr-form-icon"><Icon name="pullRequest" size={14} /></span>
        <div className="pr-form-heading">
          <h3>Draft pull request</h3>
          <p className="pr-branch" title={`${pr.draft.repo}: ${pr.draft.branch} into ${pr.draft.base}`}>
            <code>{pr.draft.branch}</code> → <code>{pr.draft.base}</code>
          </p>
        </div>
      </div>

      {pr.error && <Note tone="error" title="Couldn’t open the draft PR">{pr.error}</Note>}

      <label className="pr-label" htmlFor={titleId}>Title</label>
      <input
        id={titleId}
        className="pr-input"
        value={title}
        maxLength={256}
        disabled={creating}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className="pr-label" htmlFor={bodyId}>Description</label>
      <textarea
        id={bodyId}
        className="pr-input pr-body"
        rows={9}
        value={body}
        maxLength={60000}
        disabled={creating}
        onChange={(e) => setBody(e.target.value)}
      />
      <p className="card-footnote">
        Commits the {fileCount} applied file{fileCount === 1 ? '' : 's'} to a new branch, pushes it to {pr.draft.repo} and
        opens a draft PR. Other changes in your workspace aren’t included.
      </p>
      <div className="stack">
        <Button type="submit" variant="primary" block icon="pullRequest" loading={creating} disabled={!title.trim()}>
          {creating ? 'Opening the draft PR…' : 'Create draft PR'}
        </Button>
        {!creating && (
          <Button variant="secondary" block onClick={() => postMessage('cancelTicketPR', { id: agent.id })}>Cancel</Button>
        )}
      </div>
    </form>
  );
}
