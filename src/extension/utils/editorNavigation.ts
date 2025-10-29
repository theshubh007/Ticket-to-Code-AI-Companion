import * as vscode from 'vscode';
import * as path from 'path';

export async function openFileAtRange(
  filePath: string,
  startLine: number,
  endLine: number,
  workspaceRoot?: string
): Promise<void> {
  // Resolve absolute path
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(workspaceRoot ?? '', filePath);

  let doc: vscode.TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(absolutePath);
  } catch {
    vscode.window.showErrorMessage(
      `Ticket to Code: could not open file "${filePath}"`
    );
    return;
  }

  const editor = await vscode.window.showTextDocument(doc, {
    preview: false,
    preserveFocus: false,
  });

  // Clamp lines to document bounds
  const lastLine = doc.lineCount - 1;
  const clampedStart = Math.max(0, Math.min(startLine, lastLine));
  const clampedEnd = Math.max(clampedStart, Math.min(endLine, lastLine));

  const range = new vscode.Range(
    new vscode.Position(clampedStart, 0),
    new vscode.Position(clampedEnd, Number.MAX_SAFE_INTEGER)
  );

  // Scroll the range into view
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

  // Highlight the range
  editor.selection = new vscode.Selection(range.start, range.end);

  // Apply decoration for visual highlight
  const decoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    isWholeLine: true,
  });

  editor.setDecorations(decoration, [range]);

  // Clear decoration after 3 seconds
  setTimeout(() => {
    decoration.dispose();
  }, 3000);
}

export function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}