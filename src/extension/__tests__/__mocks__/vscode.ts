const vscode = {
  window: {
    showInputBox: jest.fn(),
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
  },
  workspace: {
    workspaceFolders: [],
    getConfiguration: jest.fn(),
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path })),
    joinPath: jest.fn((...args: { fsPath: string }[]) => ({
      fsPath: args.map((a) => a.fsPath).join('/'),
    })),
  },
  SecretStorage: jest.fn(),
  EventEmitter: jest.fn(),
};

module.exports = vscode;