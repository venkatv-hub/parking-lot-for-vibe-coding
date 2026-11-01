'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const PLUGIN = path.join(__dirname, '..', 'plugins', 'idea-parking-lot');
const backlog = require(path.join(PLUGIN, 'lib', 'backlog.js'));

function tmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipl-'));
  fs.mkdirSync(path.join(dir, '.git'));
  fs.mkdirSync(path.join(dir, 'src'));
  return dir;
}

function runHook(prompt, cwd, extra = {}) {
  const r = spawnSync(process.execPath, [path.join(PLUGIN, 'scripts', 'capture.js')], {
    input: JSON.stringify({ prompt, cwd, hook_event_name: 'UserPromptSubmit', ...extra }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: '', IDEA_PARKING_LOT_FILE: '' },
  });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
}

// ---------- library ----------

test('finds the project root from a subfolder', () => {
  const dir = tmpProject();
  assert.strictEqual(backlog.resolveBacklogPath(path.join(dir, 'src')), path.join(dir, '.ideas', 'backlog.md'));
});

test('add, list, status, edit, remove', () => {
  const file = path.join(tmpProject(), '.ideas', 'backlog.md');
  const a = backlog.addIdea(file, 'Add dark mode', { source: 'cli' });
  const b = backlog.addIdea(file, 'Cache API calls\nuse an LRU\n\nmax 100 entries', { details: 'see src/api.ts' });
  assert.strictEqual(a.id, 1);
  assert.strictEqual(b.id, 2);
  assert.strictEqual(b.details, 'use an LRU\nmax 100 entries\nsee src/api.ts');
  assert.strictEqual(backlog.getIdea(file, 1).source, 'cli');

  backlog.setStatus(file, 1, 'done');
  assert.deepStrictEqual(backlog.listIdeas(file).map((i) => i.id), [2]);
  assert.strictEqual(backlog.listIdeas(file, { include: 'all' }).length, 2);

  backlog.editIdea(file, 2, 'Cache API responses');
  const edited = backlog.getIdea(file, 2);
  assert.strictEqual(edited.text, 'Cache API responses');
  assert.strictEqual(edited.details, 'use an LRU\nmax 100 entries\nsee src/api.ts');

  backlog.removeIdea(file, 2);
  assert.strictEqual(backlog.getIdea(file, 2), null);
  // Ids are never reused while the file still has a higher one.
  assert.strictEqual(backlog.addIdea(file, 'Next').id, 2);
});

test('keeps hand-written notes in the file', () => {
  const file = path.join(tmpProject(), '.ideas', 'backlog.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# My ideas\n\nSome notes I wrote.\n\n- [ ] #4 Existing idea\n  with details\n\n## Later\n- [x] #7 Old one\n');
  backlog.addIdea(file, 'New one');
  backlog.setStatus(file, 4, 'pulled');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /Some notes I wrote\./);
  assert.match(text, /## Later/);
  assert.match(text, /- \[~\] #4 Existing idea\n {2}with details/);
  assert.match(text, /- \[ \] #8 New one/);
});

test('rejects empty ideas and unknown ids', () => {
  const file = path.join(tmpProject(), '.ideas', 'backlog.md');
  assert.throws(() => backlog.addIdea(file, '   '), /empty/);
  assert.throws(() => backlog.setStatus(file, 99, 'done'), /No idea #99/);
  assert.throws(() => backlog.setStatus(file, 1, 'nope'), /Unknown status/);
});

// ---------- hook ----------

test('hook: "idea:" parks the idea and blocks the prompt', () => {
  const dir = tmpProject();
  const out = runHook('idea: add a dark mode toggle', path.join(dir, 'src'));
  assert.strictEqual(out.decision, 'block');
  assert.match(out.reason, /Parked idea #1/);
  assert.strictEqual(out.hookSpecificOutput.suppressOriginalPrompt, true);
  assert.strictEqual(backlog.getIdea(path.join(dir, '.ideas', 'backlog.md'), 1).text, 'add a dark mode toggle');
});

test('hook: normal prompts pass through untouched', () => {
  const dir = tmpProject();
  assert.strictEqual(runHook('fix the login bug', dir), null);
  assert.strictEqual(runHook('I have an idea: what if we used Redis?', dir), null);
  assert.ok(!fs.existsSync(path.join(dir, '.ideas')));
});

test('hook: "ideas" lists, "idea go N" injects context, "idea done N" updates', () => {
  const dir = tmpProject();
  runHook('park: cache API calls', dir);
  runHook('IDEA: retry on 429', dir);

  const list = runHook('ideas', dir);
  assert.strictEqual(list.decision, 'block');
  assert.match(list.reason, /#1 {2}cache API calls/);
  assert.match(list.reason, /#2 {2}retry on 429/);

  const go = runHook('idea go 2 keep it small', dir);
  assert.strictEqual(go.decision, undefined);
  assert.match(go.hookSpecificOutput.additionalContext, /retry on 429/);
  assert.match(go.hookSpecificOutput.additionalContext, /keep it small/);
  const file = path.join(dir, '.ideas', 'backlog.md');
  assert.strictEqual(backlog.getIdea(file, 2).status, 'pulled');

  assert.match(runHook('idea done 2', dir).reason, /marked done/);
  assert.match(runHook('idea triage', dir).hookSpecificOutput.additionalContext, /cache API calls/);
  assert.match(runHook('idea go 9', dir).reason, /No idea #9/);
});

test('hook: Codex output leaves out Claude-only fields', () => {
  const dir = tmpProject();
  const out = runHook('idea: try bun', dir, { turn_id: 't1' });
  assert.strictEqual(out.decision, 'block');
  assert.strictEqual(out.hookSpecificOutput, undefined);
});

// ---------- CLI ----------

test('cli: add, list, show, pull', () => {
  const dir = tmpProject();
  const cli = (...args) =>
    spawnSync(process.execPath, [path.join(PLUGIN, 'bin', 'idea.js'), ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, IDEA_PARKING_LOT_FILE: '', IDEA_PARKING_LOT_NO_CLIPBOARD: '1' },
    });
  assert.match(cli('add', 'write more tests').stdout, /Parked #1/);
  assert.match(cli('just type it').stdout, /Parked #2/);
  assert.match(cli().stdout, /#2 {2}just type it/);
  assert.strictEqual(cli('show', '1').stdout.trim(), 'write more tests');
  assert.strictEqual(cli('pull', '#1').stdout.trim(), 'write more tests');
  assert.match(cli('list').stdout, /→ #1/);
  assert.strictEqual(cli('show', '7').status, 1);
});

// ---------- MCP server ----------

test('mcp: initialize, list tools, park and read an idea', async () => {
  const dir = tmpProject();
  const proc = spawn(process.execPath, [path.join(PLUGIN, 'mcp', 'server.js')], {
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: '', IDEA_PARKING_LOT_FILE: '' },
  });
  let buf = '';
  const waiting = new Map();
  proc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      waiting.get(msg.id)(msg);
    }
  });
  let n = 0;
  const call = (method, params) =>
    new Promise((resolve) => {
      const id = ++n;
      waiting.set(id, resolve);
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });

  const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  assert.strictEqual(init.result.serverInfo.name, 'idea-parking-lot');
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const tools = await call('tools/list', {});
  assert.deepStrictEqual(tools.result.tools.map((t) => t.name), ['park_idea', 'list_ideas', 'get_idea', 'update_idea']);

  const parked = await call('tools/call', { name: 'park_idea', arguments: { text: 'Add CSV export', details: 'reports page' } });
  assert.match(parked.result.content[0].text, /Parked idea #1/);
  const got = await call('tools/call', { name: 'get_idea', arguments: { id: 1 } });
  assert.match(got.result.content[0].text, /Add CSV export\n\nreports page/);
  const missing = await call('tools/call', { name: 'get_idea', arguments: { id: 5 } });
  assert.strictEqual(missing.result.isError, true);
  const unknown = await call('nope', {});
  assert.strictEqual(unknown.error.code, -32601);

  proc.kill();
});

// ---------- packaging ----------

test('manifests are valid JSON and point at real files', () => {
  const root = path.join(__dirname, '..');
  const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  for (const p of [
    '.claude-plugin/marketplace.json',
    '.agents/plugins/marketplace.json',
    'plugins/idea-parking-lot/.claude-plugin/plugin.json',
    'plugins/idea-parking-lot/.codex-plugin/plugin.json',
    'plugins/idea-parking-lot/hooks/hooks.json',
    'plugins/idea-parking-lot/.mcp.json',
    'vscode-extension/package.json',
  ]) read(p);
  const ext = read('vscode-extension/package.json');
  assert.ok(fs.existsSync(path.join(root, 'vscode-extension', ext.main)));
  assert.ok(fs.existsSync(path.join(root, 'vscode-extension', ext.icon)));
  const commands = new Set(ext.contributes.commands.map((c) => c.command));
  const src = fs.readFileSync(path.join(root, 'vscode-extension', 'extension.js'), 'utf8');
  for (const c of commands) assert.ok(src.includes(`'${c}'`), `${c} is declared but not registered`);
});
