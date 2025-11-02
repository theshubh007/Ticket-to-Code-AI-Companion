type VsCodeApi = {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

declare function acquireVsCodeApi(): VsCodeApi;

const vscode: VsCodeApi = acquireVsCodeApi();

export function postMessage(command: string, payload?: unknown) {
  vscode.postMessage({ command, payload });
}

export function getState<T>(): T | undefined {
  return vscode.getState() as T | undefined;
}

export function setState(state: unknown) {
  vscode.setState(state);
}