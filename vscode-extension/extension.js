'use strict';
// Idea Parking Lot: a sidebar for ideas you have while coding with AI.
// Ideas live in <workspace>/.ideas/backlog.md (shared with the CLI and the
// Claude Code / Codex plugin). Nothing is sent to an AI until you click an idea.

const path = require('path');
const vscode = require('vscode');
const backlog = require('./lib/backlog');

const EXT = {
  claude: 'anthropic.claude-code',
  codex: 'openai.chatgpt',
  copilot: 'github.copilot-chat',
};

const TARGETS = {
  'claude-code': { label: '$(sparkle) Claude Code', detail: 'Opens Claude Code with the idea typed in. Review it, then press Enter.' },
  codex: { label: '$(hubot) Codex', detail: 'Copies the idea and opens the Codex sidebar. Paste with Cmd/Ctrl+V.' },
  copilot: { label: '$(copilot) Copilot Chat', detail: 'Opens Copilot Chat with the idea typed in.' },
  terminal: { label: '$(terminal) Active terminal', detail: 'Types the idea into the terminal (Claude Code CLI, Codex CLI, Aider…) without pressing Enter.' },
  clipboard: { label: '$(clippy) Clipboard', detail: 'For Cursor, Windsurf, Kiro or any other chat. Paste it yourself.' },
};

const ICONS = { open: 'lightbulb', pulled: 'arrow-circle-right', done: 'check', dropped: 'circle-slash' };

function cfg() {
  return vscode.workspace.getConfiguration('ideaParkingLot');
}

function folder() {
  const folders = vscode.workspace.workspaceFolders;
  // Multi-root workspaces use the first folder.
  return folders && folders.length ? folders[0].uri.fsPath : null;
}

function backlogFile() {
  const root = folder();
  return root ? path.join(root, cfg().get('file', '.ideas/backlog.md')) : null;
}

function requireFile() {
  const file = backlogFile();
  if (!file) throw new Error('Open a folder first. Ideas are saved inside your project.');
  return file;
}

// ---------- tree ----------

class IdeasProvider {
  constructor() {
    this._emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._emitter.event;
  }
  refresh() {
    this._emitter.fire();
  }
  getChildren(element) {
    if (element) return [];
    const file = backlogFile();
    if (!file) return [];
    try {
      return backlog.listIdeas(file, { include: cfg().get('showCompleted') ? 'all' : 'active' });
    } catch (err) {
      vscode.window.showErrorMessage(`Idea Parking Lot: ${err.message}`);
      return [];
    }
  }
  getTreeItem(idea) {
    const item = new vscode.TreeItem(`#${idea.id}  ${idea.text}`, vscode.TreeItemCollapsibleState.None);
    item.id = String(idea.id);
    item.iconPath = new vscode.ThemeIcon(ICONS[idea.status]);
    item.contextValue = `idea-${idea.status}`;
    item.description = idea.status === 'pulled' ? 'sent' : idea.status === 'open' ? age(idea.added) : idea.status;
    const tip = new vscode.MarkdownString();
    tip.appendText(backlog.toPrompt(idea));
    tip.appendMarkdown(`\n\n---\n*${idea.status}${idea.added ? ` · added ${idea.added}` : ''}${idea.source ? ` · via ${idea.source}` : ''}* — click to send to your AI`);
    item.tooltip = tip;
    item.command = { command: 'ideaParkingLot.send', title: 'Send to AI', arguments: [idea] };
    return item;
  }
}

function age(added) {
  if (!added) return '';
  const days = Math.floor((Date.now() - new Date(`${added}T00:00:00`).getTime()) / 86400000);
  if (Number.isNaN(days)) return '';
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
}

// ---------- sending ----------

function installed(id) {
  return !!vscode.extensions.getExtension(id);
}

function autoTarget() {
  if (installed(EXT.claude)) return 'claude-code';
  if (installed(EXT.codex)) return 'codex';
  if (installed(EXT.copilot)) return 'copilot';
  return 'clipboard';
}

async function pickTarget() {
  const order = ['claude-code', 'codex', 'copilot', 'terminal', 'clipboard'];
  const available = order.filter(
    (t) =>
      (t === 'claude-code' && installed(EXT.claude)) ||
      (t === 'codex' && installed(EXT.codex)) ||
      (t === 'copilot' && installed(EXT.copilot)) ||
      (t === 'terminal' && vscode.window.terminals.length > 0) ||
      t === 'clipboard',
  );
  const pick = await vscode.window.showQuickPick(
    available.map((t) => ({ ...TARGETS[t], target: t })),
    { placeHolder: 'Send this idea to…' },
  );
  return pick && pick.target;
}

async function resolveTarget(forceAsk) {
  const setting = cfg().get('sendTo', 'auto');
  if (forceAsk || setting === 'ask') return pickTarget();
  return setting === 'auto' ? autoTarget() : setting;
}

// Returns true when the text was handed over.
async function deliver(text, target) {
  switch (target) {
    case 'claude-code': {
      await vscode.env.clipboard.writeText(text); // backup, e.g. to paste into an existing chat
      // Claude Code (v2.1.72+) opens a new tab with the prompt typed in but not sent.
      // Its public link vscode://anthropic.claude-code/open?prompt=... calls this command,
      // so we call the command directly when it exists and use the link otherwise.
      let ok = false;
      const commands = await vscode.commands.getCommands(true);
      if (commands.includes('claude-vscode.primaryEditor.open')) {
        await vscode.commands.executeCommand('claude-vscode.primaryEditor.open', undefined, text);
        ok = true;
      } else {
        const uri = vscode.Uri.from({
          scheme: vscode.env.uriScheme,
          authority: EXT.claude,
          path: '/open',
          query: `prompt=${encodeURIComponent(text)}`,
        });
        ok = await vscode.env.openExternal(uri);
      }
      if (ok) vscode.window.setStatusBarMessage('$(sparkle) Idea is in Claude Code. Review it and press Enter. (Also on your clipboard.)', 6000);
      return ok;
    }
    case 'codex': {
      await vscode.env.clipboard.writeText(text);
      try {
        await vscode.commands.executeCommand('chatgpt.openSidebar');
      } catch {
        /* Codex not installed or command unavailable in this editor */
      }
      vscode.window.showInformationMessage('Idea copied. Paste it into Codex with Cmd/Ctrl+V.');
      return true;
    }
    case 'copilot': {
      try {
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: text, isPartialQuery: true });
        return true;
      } catch {
        return deliver(text, 'clipboard');
      }
    }
    case 'terminal': {
      const term = vscode.window.activeTerminal;
      if (!term) {
        vscode.window.showWarningMessage('No terminal is open. Start your agent (e.g. `claude` or `codex`) in a terminal first.');
        return false;
      }
      term.show();
      // One line, no Enter: newlines would submit early in most CLI agents.
      term.sendText(text.replace(/\s*\r?\n\s*/g, ' '), false);
      return true;
    }
    case 'clipboard':
    default:
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage('Idea copied. Paste it into your AI chat with Cmd/Ctrl+V.');
      return true;
  }
}

// ---------- activation ----------

function activate(context) {
  const provider = new IdeasProvider();
  const view = vscode.window.createTreeView('ideaParkingLot.ideas', { treeDataProvider: provider });

  const refresh = () => {
    provider.refresh();
    const file = backlogFile();
    let open = 0;
    try {
      open = file ? backlog.listIdeas(file, { include: 'open' }).length : 0;
    } catch {
      /* shown by the tree */
    }
    view.badge = open ? { value: open, tooltip: `${open} open idea${open === 1 ? '' : 's'}` } : undefined;
  };

  let watcher;
  const watch = () => {
    if (watcher) watcher.dispose();
    const root = folder();
    if (!root) return;
    watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, cfg().get('file', '.ideas/backlog.md')));
    watcher.onDidChange(refresh);
    watcher.onDidCreate(refresh);
    watcher.onDidDelete(refresh);
  };
  watch();
  refresh();

  // Wraps a command so errors show up as a friendly message.
  const cmd = (id, fn) =>
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async (...args) => {
        try {
          await fn(...args);
        } catch (err) {
          vscode.window.showErrorMessage(`Idea Parking Lot: ${err.message}`);
        }
        refresh();
      }),
    );

  const send = async (idea, forceAsk) => {
    const file = requireFile();
    const target = await resolveTarget(forceAsk);
    if (!target) return;
    const fresh = backlog.getIdea(file, idea.id) || idea;
    if (await deliver(backlog.toPrompt(fresh), target)) backlog.setStatus(file, idea.id, 'pulled');
  };

  cmd('ideaParkingLot.add', async () => {
    const file = requireFile();
    const text = await vscode.window.showInputBox({
      title: 'Park an idea',
      prompt: 'Saved to your project. Your AI won\'t see it until you send it.',
      placeHolder: 'e.g. Add rate limiting to the upload endpoint',
      ignoreFocusOut: true,
    });
    if (!text || !text.trim()) return;
    const it = backlog.addIdea(file, text, { source: 'vscode' });
    vscode.window.setStatusBarMessage(`$(lightbulb) Parked idea #${it.id}`, 3000);
  });

  cmd('ideaParkingLot.addFromSelection', async () => {
    const file = requireFile();
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) return;
    const selected = editor.document.getText(editor.selection);
    const firstLine = (selected.split(/\r?\n/).find((l) => l.trim()) || '').trim().replace(/^(\/\/|#|\*|--)\s*/, '');
    const text = await vscode.window.showInputBox({
      title: 'Park selection as an idea',
      value: firstLine.slice(0, 120),
      ignoreFocusOut: true,
    });
    if (!text || !text.trim()) return;
    const rel = vscode.workspace.asRelativePath(editor.document.uri);
    const line = editor.selection.start.line + 1;
    const it = backlog.addIdea(file, text, { source: 'vscode', details: `See ${rel}:${line}` });
    vscode.window.setStatusBarMessage(`$(lightbulb) Parked idea #${it.id}`, 3000);
  });

  cmd('ideaParkingLot.send', (idea) => idea && send(idea, false));
  cmd('ideaParkingLot.sendTo', (idea) => idea && send(idea, true));
  cmd('ideaParkingLot.copy', async (idea) => {
    if (!idea) return;
    await vscode.env.clipboard.writeText(backlog.toPrompt(idea));
    vscode.window.setStatusBarMessage('$(clippy) Idea copied', 2000);
  });
  cmd('ideaParkingLot.done', (idea) => idea && backlog.setStatus(requireFile(), idea.id, 'done'));
  cmd('ideaParkingLot.drop', (idea) => idea && backlog.setStatus(requireFile(), idea.id, 'dropped'));
  cmd('ideaParkingLot.reopen', (idea) => idea && backlog.setStatus(requireFile(), idea.id, 'open'));
  cmd('ideaParkingLot.edit', async (idea) => {
    if (!idea) return;
    const text = await vscode.window.showInputBox({ title: `Edit idea #${idea.id}`, value: idea.text, ignoreFocusOut: true });
    if (text && text.trim()) backlog.editIdea(requireFile(), idea.id, text);
  });
  cmd('ideaParkingLot.delete', async (idea) => {
    if (!idea) return;
    const yes = await vscode.window.showWarningMessage(
      `Delete idea #${idea.id} from backlog.md? "Drop" keeps it in the file instead.`,
      { modal: true },
      'Delete',
    );
    if (yes === 'Delete') backlog.removeIdea(requireFile(), idea.id);
  });

  cmd('ideaParkingLot.triage', async () => {
    const file = requireFile();
    const open = backlog.listIdeas(file, { include: 'open' });
    if (!open.length) return vscode.window.showInformationMessage('No open ideas to prioritize yet.');
    const target = await resolveTarget(false);
    if (target) await deliver(backlog.triagePrompt(vscode.workspace.asRelativePath(file), open), target);
  });

  cmd('ideaParkingLot.openFile', async () => {
    const file = requireFile();
    const fs = require('fs');
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, backlog.HEADER, 'utf8');
    }
    await vscode.window.showTextDocument(vscode.Uri.file(file));
  });

  cmd('ideaParkingLot.toggleCompleted', () =>
    cfg().update('showCompleted', !cfg().get('showCompleted'), vscode.ConfigurationTarget.Global));
  cmd('ideaParkingLot.refresh', () => {});

  context.subscriptions.push(
    view,
    { dispose: () => watcher && watcher.dispose() },
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ideaParkingLot')) {
        watch();
        refresh();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      watch();
      refresh();
    }),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
