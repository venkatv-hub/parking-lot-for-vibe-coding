'use strict';
// Shared by the hook, CLI, MCP server and VS Code extension. No dependencies.
//
// The backlog is a plain Markdown file (default: <project>/.ideas/backlog.md).
// Each idea is one line:   - [ ] #3 Add dark mode toggle  <!-- 2026-11-01 vscode -->
// Indented lines right below an idea are its details. Everything else in the
// file is left untouched, so people can edit it by hand.

const fs = require('fs');
const path = require('path');

const MARK_TO_STATUS = { ' ': 'open', '~': 'pulled', x: 'done', X: 'done', '-': 'dropped' };
const STATUS_TO_MARK = { open: ' ', pulled: '~', done: 'x', dropped: '-' };
const STATUSES = Object.keys(STATUS_TO_MARK);
const ITEM_RE = /^- \[([ ~xX-])\] #(\d+) (.*?)\s*(?:<!--(.*?)-->)?\s*$/;

const HEADER = [
  '# Idea Parking Lot',
  '',
  'Ideas parked while building. They stay out of your AI chat until you send one in.',
  '',
  'Legend: `[ ]` open · `[~]` sent to a chat · `[x]` done · `[-]` dropped',
  '',
  '<!-- Edit freely. One idea per "- [ ] #N" line; indented lines under an idea are its details. -->',
  '',
].join('\n');

// ---------- locating the file ----------

function findProjectRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dir, '.ideas')) || fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start || process.cwd());
    dir = parent;
  }
}

function resolveBacklogPath(start) {
  const override = process.env.IDEA_PARKING_LOT_FILE;
  const root = findProjectRoot(start);
  if (override) return path.resolve(root, override);
  return path.join(root, '.ideas', 'backlog.md');
}

// ---------- parsing ----------

function parse(text) {
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const m = ITEM_RE.exec(lines[i]);
    if (!m) continue;
    let end = i;
    const details = [];
    while (end + 1 < lines.length && /^(\s{2,}|\t)\S/.test(lines[end + 1])) {
      end++;
      details.push(lines[end].replace(/^(\s{2}|\t)/, ''));
    }
    const meta = (m[4] || '').trim().split(/\s+/).filter(Boolean);
    items.push({
      id: Number(m[2]),
      status: MARK_TO_STATUS[m[1]],
      text: m[3],
      details: details.join('\n'),
      added: meta[0] || null,
      source: meta.slice(1).join(' ') || null,
      line: i,
      end,
    });
    i = end;
  }
  return { lines, items };
}

function load(file) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  return { file, ...parse(text) };
}

function save(file, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let text = lines.join('\n');
  if (!text.endsWith('\n')) text += '\n';
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- public API ----------

function addIdea(file, rawText, opts = {}) {
  const text = String(rawText || '').trim();
  if (!text) throw new Error('The idea is empty.');
  const [first, ...rest] = text.split(/\r?\n/);
  const title = first.trim().replace(/<!--|-->/g, '');
  const extra = [rest.join('\n').trim(), (opts.details || '').trim()].filter(Boolean).join('\n');

  const doc = load(file);
  const lines = doc.lines.length === 1 && doc.lines[0] === '' ? [] : doc.lines;
  if (lines.length === 0) lines.push(...HEADER.split('\n'));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (!doc.items.length && lines.length) lines.push(''); // space between header and first idea

  const id = doc.items.reduce((max, it) => Math.max(max, it.id), 0) + 1;
  const source = opts.source ? ` ${String(opts.source).replace(/\s+/g, '-')}` : '';
  lines.push(`- [ ] #${id} ${title}  <!-- ${today()}${source} -->`);
  // Blank lines would end the details block, so they are skipped.
  if (extra) for (const l of extra.split(/\r?\n/)) if (l.trim()) lines.push(`  ${l}`);
  save(file, lines);
  return getIdea(file, id);
}

function listIdeas(file, opts = {}) {
  const include = opts.include || 'active';
  const items = load(file).items.map(strip);
  if (include === 'all') return items;
  if (include === 'active') return items.filter((it) => it.status === 'open' || it.status === 'pulled');
  return items.filter((it) => it.status === include);
}

function getIdea(file, id) {
  const it = load(file).items.find((x) => x.id === Number(id));
  return it ? strip(it) : null;
}

function setStatus(file, id, status) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status "${status}". Use: ${STATUSES.join(', ')}.`);
  const doc = load(file);
  const it = doc.items.find((x) => x.id === Number(id));
  if (!it) throw new Error(`No idea #${id}.`);
  doc.lines[it.line] = doc.lines[it.line].replace(/^- \[[ ~xX-]\]/, `- [${STATUS_TO_MARK[status]}]`);
  save(file, doc.lines);
  return { ...strip(it), status };
}

function removeIdea(file, id) {
  const doc = load(file);
  const it = doc.items.find((x) => x.id === Number(id));
  if (!it) throw new Error(`No idea #${id}.`);
  doc.lines.splice(it.line, it.end - it.line + 1);
  save(file, doc.lines);
  return strip(it);
}

function editIdea(file, id, newText) {
  const doc = load(file);
  const it = doc.items.find((x) => x.id === Number(id));
  if (!it) throw new Error(`No idea #${id}.`);
  const title = String(newText || '').trim().split(/\r?\n/)[0].replace(/<!--|-->/g, '');
  if (!title) throw new Error('The idea is empty.');
  doc.lines[it.line] = doc.lines[it.line].replace(ITEM_RE, (all, mark, num, _t, meta) =>
    `- [${mark}] #${num} ${title}${meta !== undefined ? `  <!--${meta}-->` : ''}`);
  save(file, doc.lines);
  return getIdea(file, id);
}

// The text that goes into a chat when an idea is sent.
function toPrompt(item) {
  return item.details ? `${item.text}\n\n${item.details}` : item.text;
}

function formatList(items, opts = {}) {
  if (!items.length) return opts.empty || 'No ideas parked yet. Park one with:  idea: <your idea>';
  const icon = { open: '○', pulled: '→', done: '✓', dropped: '×' };
  return items
    .map((it) => `${icon[it.status]} #${it.id}  ${it.text}${it.status === 'pulled' ? '  (sent to chat)' : ''}`)
    .join('\n');
}

function triagePrompt(file, items) {
  const list = items.map((it) => `- #${it.id} ${toPrompt(it).replace(/\n/g, ' ')}`).join('\n');
  return [
    `Here are the ideas I parked while building (from ${file}):`,
    '',
    list,
    '',
    'Please triage them. Group them by theme, point out duplicates, and rank them by impact versus effort.',
    'Give me a short, ordered list with a one-line reason for each. Do not start implementing anything yet.',
  ].join('\n');
}

function strip(it) {
  const { line, end, ...rest } = it;
  return rest;
}

module.exports = {
  HEADER,
  STATUSES,
  findProjectRoot,
  resolveBacklogPath,
  parse,
  load,
  addIdea,
  listIdeas,
  getIdea,
  setStatus,
  removeIdea,
  editIdea,
  toPrompt,
  formatList,
  triagePrompt,
};
