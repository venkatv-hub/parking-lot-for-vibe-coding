#!/usr/bin/env node
'use strict';
// Minimal MCP server (stdio, JSON-RPC 2.0, no dependencies).
// Lets any MCP-capable agent park ideas for later and read them back,
// without loading the whole backlog into its context.

const readline = require('readline');
const backlog = require('../lib/backlog');
const { version } = require('../package.json');

function fileFor(args) {
  const start = (args && args.project_dir) || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return backlog.resolveBacklogPath(start);
}

const projectDirProp = {
  project_dir: {
    type: 'string',
    description: 'Absolute path of the project. Optional; defaults to the directory the agent was started in.',
  },
};

const TOOLS = [
  {
    name: 'park_idea',
    description:
      'Save a side idea to the project\'s idea parking lot (.ideas/backlog.md) WITHOUT working on it. ' +
      'Use when the user says things like "park this", "later", "add to my ideas", or when you notice a ' +
      'worthwhile improvement that is out of scope for the current task. Keep the text to one clear sentence.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The idea, one sentence.' },
        details: { type: 'string', description: 'Optional extra notes, e.g. file paths or context.' },
        ...projectDirProp,
      },
      required: ['text'],
    },
  },
  {
    name: 'list_ideas',
    description: 'List parked ideas as short one-line titles. Use "active" (default) for open and in-progress ideas.',
    inputSchema: {
      type: 'object',
      properties: {
        include: { type: 'string', enum: ['active', 'open', 'pulled', 'done', 'dropped', 'all'] },
        ...projectDirProp,
      },
    },
  },
  {
    name: 'get_idea',
    description: 'Get one parked idea with its details, by number.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' }, ...projectDirProp },
      required: ['id'],
    },
  },
  {
    name: 'update_idea',
    description: 'Change an idea\'s status: open, pulled (being worked on), done, or dropped.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        status: { type: 'string', enum: backlog.STATUSES },
        ...projectDirProp,
      },
      required: ['id', 'status'],
    },
  },
];

function callTool(name, args = {}) {
  const file = fileFor(args);
  switch (name) {
    case 'park_idea': {
      const it = backlog.addIdea(file, args.text, { details: args.details, source: 'agent' });
      return `Parked idea #${it.id}: ${it.text}`;
    }
    case 'list_ideas':
      return backlog.formatList(backlog.listIdeas(file, { include: args.include || 'active' }));
    case 'get_idea': {
      const it = backlog.getIdea(file, args.id);
      if (!it) throw new Error(`No idea #${args.id}.`);
      return `#${it.id} [${it.status}] ${backlog.toPrompt(it)}`;
    }
    case 'update_idea': {
      const it = backlog.setStatus(file, args.id, args.status);
      return `Idea #${it.id} is now ${it.status}.`;
    }
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  }
}

function respond(id, result, error) {
  const msg = error ? { jsonrpc: '2.0', id, error } : { jsonrpc: '2.0', id, result };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function onMessage(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  switch (method) {
    case 'initialize':
      return respond(id, {
        protocolVersion: (params && params.protocolVersion) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'idea-parking-lot', version },
      });
    case 'ping':
      return respond(id, {});
    case 'tools/list':
      return respond(id, { tools: TOOLS });
    case 'tools/call': {
      try {
        const text = callTool(params && params.name, params && params.arguments);
        return respond(id, { content: [{ type: 'text', text }] });
      } catch (err) {
        if (err.code === -32602) return respond(id, null, { code: -32602, message: err.message });
        return respond(id, { content: [{ type: 'text', text: err.message }], isError: true });
      }
    }
    default:
      if (isRequest) respond(id, null, { code: -32601, message: `Method not found: ${method}` });
  }
}

function start() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return respond(null, null, { code: -32700, message: 'Parse error' });
    }
    for (const m of Array.isArray(msg) ? msg : [msg]) onMessage(m);
  });
}

if (require.main === module) start();
module.exports = { start, callTool, TOOLS };
