#!/usr/bin/env node
'use strict';
// `idea` command: use the parking lot from any terminal, with any AI tool.

const { spawnSync } = require('child_process');
const backlog = require('../lib/backlog');

const USAGE = `idea - a parking lot for ideas you have while coding with AI

  idea add <text>       park an idea
  idea                  list open ideas  (idea list --all for everything)
  idea show <n>         print idea #n
  idea pull <n>         print idea #n, copy it to the clipboard, mark it as sent
  idea done <n>         mark done        idea drop <n>    drop it
  idea reopen <n>       reopen           idea rm <n>      delete it from the file
  idea triage           print a prompt asking an AI to rank your open ideas
  idea path             show where the backlog file lives
  idea mcp              run the MCP server (for agents)
  idea hook             run the chat hook (for manual Claude Code / Codex hook setup)

Send an idea straight into an agent:
  claude "$(idea pull 3)"
  codex  "$(idea pull 3)"`;

function copy(text) {
  if (process.env.IDEA_PARKING_LOT_NO_CLIPBOARD) return false;
  const tries =
    process.platform === 'darwin' ? [['pbcopy']]
    : process.platform === 'win32' ? [['clip']]
    : [['wl-copy'], ['xclip', '-selection', 'clipboard'], ['xsel', '--clipboard', '--input']];
  for (const [cmd, ...args] of tries) {
    const r = spawnSync(cmd, args, { input: text });
    if (!r.error && r.status === 0) return true;
  }
  return false;
}

function need(n) {
  if (!n || !/^#?\d+$/.test(n)) fail('Give an idea number, e.g.  idea pull 3');
  return n.replace('#', '');
}

function fail(msg) {
  process.stderr.write(msg + '\n');
  process.exit(1);
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const file = backlog.resolveBacklogPath(process.cwd());
  const log = (s) => process.stdout.write(s + '\n');
  // Status messages go to stderr so `$(idea pull 3)` only captures the idea text.
  const note = (s) => process.stderr.write(s + '\n');

  switch (cmd) {
    case undefined:
    case 'list':
    case 'ls':
      return log(backlog.formatList(backlog.listIdeas(file, { include: rest.includes('--all') ? 'all' : 'active' })));
    case 'add': {
      const text = rest.join(' ');
      if (!text.trim()) fail('Usage: idea add <text>');
      const it = backlog.addIdea(file, text, { source: 'cli' });
      return log(`💡 Parked #${it.id}: ${it.text}`);
    }
    case 'show': {
      const it = backlog.getIdea(file, need(rest[0]));
      if (!it) fail(`No idea #${rest[0]}.`);
      return log(backlog.toPrompt(it));
    }
    case 'pull': {
      const it = backlog.getIdea(file, need(rest[0]));
      if (!it) fail(`No idea #${rest[0]}.`);
      backlog.setStatus(file, it.id, 'pulled');
      const text = backlog.toPrompt(it);
      if (copy(text)) note(`Copied idea #${it.id} to the clipboard.`);
      return log(text);
    }
    case 'done':
    case 'drop':
    case 'reopen': {
      const status = { done: 'done', drop: 'dropped', reopen: 'open' }[cmd];
      const it = backlog.setStatus(file, need(rest[0]), status);
      return log(`Idea #${it.id} marked ${status}.`);
    }
    case 'rm': {
      const it = backlog.removeIdea(file, need(rest[0]));
      return log(`Deleted idea #${it.id}: ${it.text}`);
    }
    case 'triage': {
      const items = backlog.listIdeas(file, { include: 'open' });
      if (!items.length) fail('No open ideas to triage.');
      return log(backlog.triagePrompt(file, items));
    }
    case 'path':
      return log(file);
    case 'mcp':
      return require('../mcp/server').start();
    case 'hook':
      return require('../scripts/capture').main();
    case 'help':
    case '-h':
    case '--help':
      return log(USAGE);
    default:
      // `idea some text` with no subcommand: treat it as "add".
      return main(['add', cmd, ...rest]);
  }
}

try {
  main(process.argv.slice(2));
} catch (err) {
  fail(err.message);
}
