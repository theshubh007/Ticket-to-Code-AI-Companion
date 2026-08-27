import React, { useEffect } from 'react';
import { ModelSummary } from '../../types';
import { ModelPickerDialog } from '../ModelPickerDialog/ModelPickerDialog';
import { Icon } from '../shared/Icon';
import { Button, NavBar, Note, SectionHeading } from '../shared/ui';

interface Props {
  chatModel: string;
  apiKeyInput: string;
  hasApiKey: boolean;
  loading: boolean;
  error: string | null;
  status: string | null;
  modelList: ModelSummary[] | null;
  modelListLoading: boolean;
  onChatModelChange: (value: string) => void;
  onApiKeyInputChange: (value: string) => void;
  onSave: () => void;
  onGetModelList: () => void;
  onBack: () => void;
}

export function SettingsView({
  chatModel,
  apiKeyInput,
  hasApiKey,
  loading,
  error,
  status,
  modelList,
  modelListLoading,
  onChatModelChange,
  onApiKeyInputChange,
  onSave,
  onGetModelList,
  onBack,
}: Props) {
  useEffect(() => {
    onGetModelList();
    // Load the model list once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen screen--push">
      <NavBar backLabel="Tickets" onBack={onBack} title="Settings" />

      <form
        className="settings"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <SectionHeading>AI model</SectionHeading>
        <div className="content-inset">
          <ModelPickerDialog
            currentModel={chatModel}
            modelList={modelList}
            modelListLoading={modelListLoading}
            disabled={loading}
            onSelect={onChatModelChange}
          />
          <p className="field-footnote">Used to propose fixes and write tests. Models are served through OpenRouter.</p>
        </div>

        <SectionHeading
          trailing={hasApiKey && (
            <span className="saved-indicator"><Icon name="checkCircle" size={12} /> Saved</span>
          )}
        >
          <label htmlFor="provider-key-input">OpenRouter API key</label>
        </SectionHeading>
        <div className="content-inset">
          <div className="text-field">
            <Icon name="key" size={14} className="text-field-icon" />
            <input
              id="provider-key-input"
              type="password"
              value={apiKeyInput}
              onChange={(event) => onApiKeyInputChange(event.target.value)}
              placeholder={hasApiKey ? 'Leave blank to keep the saved key' : 'sk-or-…'}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <p className="field-footnote">Stored in VS Code’s secret storage, never in your settings files.</p>
        </div>

        <div className="content-inset stack">
          {status && !loading && <Note tone="success">{status}</Note>}
          {error && !loading && <Note tone="error">{error}</Note>}
          <Button type="submit" variant="primary" block loading={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </div>

        <SectionHeading>Jira</SectionHeading>
        <p className="field-footnote content-inset">
          To change your Jira site or credentials, run <kbd>Ticket to Code: Reset Credentials</kbd> from the Command Palette.
        </p>
      </form>
    </div>
  );
}
