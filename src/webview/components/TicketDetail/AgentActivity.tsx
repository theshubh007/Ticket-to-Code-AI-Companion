import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AgentStep, TicketAgentStatus } from '../../../extension/types';
import { postMessage } from '../../vscodeApi';
import { Icon, IconName } from '../shared/Icon';
import { Disclosure, Note } from '../shared/ui';

const KIND_ICON: Record<AgentStep['kind'], IconName> = {
  index: 'tray',
  search: 'search',
  list: 'list',
  read: 'file',
  edit: 'fileCode',
  discard: 'x',
  finish: 'checkCircle',
  request: 'message',
  test: 'flask',
};

/** The agent's actions in order, newest last. While `live`, it follows the newest step. */
export function ActivityList({ steps, live = false }: { steps: AgentStep[]; live?: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (live && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [live, steps.length]);

  return (
    // Steps arrive quickly; the card's status line already announces progress.
    <ol ref={ref} className={`timeline${live ? ' timeline--live' : ''}`} aria-label="Agent activity" aria-live="off">
      {steps.map((step, i) => {
        const classes = ['timeline-step'];
        if (!step.ok) classes.push('timeline-step--failed');
        if (step.kind === 'request') classes.push('timeline-step--request');
        return (
          <li key={i} className={classes.join(' ')}>
            <span className="timeline-icon"><Icon name={step.ok ? KIND_ICON[step.kind] : 'alert'} size={12} /></span>
            <span className="timeline-text">
              <span className="timeline-label" title={step.label}>{step.label}</span>
              {step.detail && <span className="timeline-detail">{step.detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Collapsed summary of a finished run, expandable to the full timeline. */
export function AgentActivity({ steps, defaultOpen = false }: { steps?: AgentStep[]; defaultOpen?: boolean }) {
  if (!steps?.length) return null;
  const failed = steps.filter((step) => !step.ok).length;
  const subtitle = `${steps.length} step${steps.length === 1 ? '' : 's'}${failed ? ` · ${failed} didn’t work` : ''}`;
  return (
    <Disclosure title="Activity" subtitle={subtitle} icon="list" defaultOpen={defaultOpen}>
      <ActivityList steps={steps} />
    </Disclosure>
  );
}

/** A warning when the developer's last request didn't produce a new proposal. */
export function RevisionNotice({ steps }: { steps?: AgentStep[] }) {
  const last = steps?.[steps.length - 1];
  if (!last || last.kind !== 'request' || last.ok) return null;
  const stopped = !last.detail;
  return (
    <Note tone="warning" title={stopped ? 'Revision stopped' : 'The revision didn’t finish'}>
      {stopped ? '' : last.detail + ' '}The earlier proposal is unchanged.
    </Note>
  );
}

const MAX_LENGTH = 2000;

/** A Claude-style composer that sends the developer's instruction back to the agent. */
export function ChangeRequest({ agent, placeholder }: { agent: TicketAgentStatus; placeholder: string }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the text up to about five lines, then scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 112) + 'px';
  }, [text]);

  const trimmed = text.trim();
  function send() {
    if (!trimmed) return;
    postMessage('reviseTicketChange', { id: agent.id, instruction: trimmed });
    setText('');
  }

  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <label className="visually-hidden" htmlFor={`change-request-${agent.id}`}>Ask for changes</label>
      <textarea
        id={`change-request-${agent.id}`}
        ref={ref}
        rows={1}
        maxLength={MAX_LENGTH}
        value={text}
        placeholder={placeholder}
        title="Enter to send, Shift+Enter for a new line"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          } else if (e.key === 'Escape') {
            // Keep the draft and stay on this screen.
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      <button type="submit" className="composer-send" aria-label="Send request" title="Send" disabled={!trimmed}>
        <Icon name="arrowUp" size={14} />
      </button>
    </form>
  );
}
