#!/usr/bin/env node
'use strict';
// UserPromptSubmit hook for Claude Code and Codex.
//
// It looks at what you typed before the AI sees it:
//   idea: <text>      save the idea and BLOCK the prompt (the AI never sees it)
//   ideas             show your list (blocked, costs no context)
//   idea go 3         send idea #3 to the AI as this turn's request
//   idea triage       ask the AI to group and rank your open ideas
//   idea done 3 / idea drop 3 / idea reopen 3 / idea help
// Anything else passes through untouched.

const backlog = require('../lib/backlog');

const HELP = [
  'Idea Parking Lot',
  '  idea: <text>     park an idea (not sent to the AI)',
  '  ideas            list open ideas      ideas all   include done and dropped',
  '  idea go 3        send idea #3 to the AI now (add more words after the number if you like)',
  '  idea triage      ask the AI to group and rank your open ideas',
  '  idea done 3      mark done            idea drop 3   drop it      idea reopen 3',
].join('\n');

// Returns { block: string } | { context: string } | null
function handle(prompt, cwd) {
  const p = String(prompt || '').trim();
  const file = () => backlog.resolveBacklogPath(cwd);

  let m = /^(?:idea|park)\s*:\s*([\s\S]+)$/i.exec(p);
  if (m) {
    const it = backlog.addIdea(file(), m[1], { source: 'chat' });
    return { block: `💡 Parked idea #${it.id}: ${it.text}\n(Not sent to the AI. Type "ideas" to see your list, "idea go ${it.id}" to send it in.)` };
  }

  m = /^ideas(?:\s+(all))?$/i.exec(p);
  if (m) {
    const items = backlog.listIdeas(file(), { include: m[1] ? 'all' : 'active' });
    return { block: `💡 Your parked ideas\n${backlog.formatList(items)}\n\nType "idea go <number>" to send one in, or "idea help".` };
  }

  if (/^idea\s+help$/i.test(p)) return { block: HELP };

  m = /^idea\s+(?:go|pull|send|use)\s+#?(\d+)\s*([\s\S]*)$/i.exec(p);
  if (m) {
    const it = backlog.getIdea(file(), m[1]);
    if (!it) return { block: `No idea #${m[1]}. Type "ideas" to see your list.` };
    backlog.setStatus(file(), it.id, 'pulled');
    const extra = m[2].trim();
    return {
      context: [
        `The user is sending idea #${it.id} from their idea parking lot (${file()}).`,
        'Treat it as their request for this turn:',
        '',
        backlog.toPrompt(it),
        extra ? `\nExtra instructions from the user: ${extra}` : '',
        '',
        `When it is finished, remind the user they can type "idea done ${it.id}".`,
      ].join('\n'),
    };
  }

  if (/^idea\s+triage$/i.test(p)) {
    const items = backlog.listIdeas(file(), { include: 'open' });
    if (!items.length) return { block: 'No open ideas to triage.' };
    return { context: backlog.triagePrompt(file(), items) };
  }

  m = /^idea\s+(done|drop|reopen)\s+#?(\d+)$/i.exec(p);
  if (m) {
    const status = { done: 'done', drop: 'dropped', reopen: 'open' }[m[1].toLowerCase()];
    const it = backlog.setStatus(file(), m[2], status);
    return { block: `💡 Idea #${it.id} marked ${status}: ${it.text}` };
  }

  return null;
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let input;
    try {
      input = JSON.parse(raw || '{}');
    } catch {
      process.exit(0); // not our business; let the prompt through
    }
    const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    // Codex sends turn_id; Claude Code does not. Only Claude Code knows suppressOriginalPrompt.
    const isCodex = input.turn_id !== undefined;

    let result;
    try {
      result = handle(input.prompt, cwd);
    } catch (err) {
      // The prompt looked like one of ours, so never leak it to the AI on failure.
      result = { block: `Idea Parking Lot error: ${err.message}` };
    }
    if (!result) process.exit(0);

    const out = result.block
      ? {
          decision: 'block',
          reason: result.block,
          ...(isCodex ? {} : { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', suppressOriginalPrompt: true } }),
        }
      : { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: result.context } };
    process.stdout.write(JSON.stringify(out));
    process.exit(0);
  });
}

if (require.main === module) main();
module.exports = { handle, main, HELP };
