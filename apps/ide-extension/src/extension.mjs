import path from 'path';

function workspaceRoot(vscode) {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
}

function cliPath(root) {
  return path.join(root, 'apps/cli/src/index.mjs');
}

function runInTerminal(vscode, command, args = []) {
  const root = workspaceRoot(vscode);
  const terminal = vscode.window.createTerminal({ name: 'Divinity Code', cwd: root });
  terminal.show();
  terminal.sendText(`node ${JSON.stringify(cliPath(root))} ${command} ${args.join(' ')}`.trim());
}

async function runTask(vscode) {
  const objective = await vscode.window.showInputBox({
    prompt: 'Task objective',
    placeHolder: 'Review README and summarize setup gaps'
  });
  if (!objective) return;
  runInTerminal(vscode, 'run', [JSON.stringify(objective)]);
}

function openDashboard(vscode) {
  const root = workspaceRoot(vscode);
  const dashboardPath = path.join(root, 'apps/dashboard/index.html');
  vscode.env.openExternal(vscode.Uri.file(dashboardPath));
}

function showDoctor(vscode) {
  runInTerminal(vscode, 'doctor');
}

export async function activate(context) {
  const vscode = await import('vscode');
  context.subscriptions.push(
    vscode.commands.registerCommand('divinity.runTask', () => runTask(vscode)),
    vscode.commands.registerCommand('divinity.openDashboard', () => openDashboard(vscode)),
    vscode.commands.registerCommand('divinity.showDoctor', () => showDoctor(vscode))
  );
}

export function deactivate() {}
