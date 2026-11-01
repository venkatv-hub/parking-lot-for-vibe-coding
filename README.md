# 💡 Idea Parking Lot for Vibe Coding

**Park ideas while you vibe code. Send them to your AI later with one click.**

You're halfway through a task with Claude Code, Codex or Copilot and a new idea pops into your head:
*"we should add rate limiting"*, *"that button needs a loading state"*. If you type it into the chat, the agent
gets distracted and your context fills up. If you don't write it down, you forget it.

Idea Parking Lot gives you a place to drop those ideas **without sending them to the AI**. When you're ready,
click one (or type `idea go 3`) and it goes into the chat as a normal prompt.

```text
  You, mid-build                 .ideas/backlog.md                  Your AI chat
 ────────────────               ───────────────────               ──────────────
  "idea: add rate     ──park──▶  - [ ] #1 add rate limiting  ──send──▶  "add rate limiting"
   limiting"                     - [ ] #2 loading state         (when YOU choose)
                                  ...
        The AI sees nothing here. No tokens used, no distraction.
```

- **Zero context cost.** Parked ideas never reach the model until you send one.
- **Just a Markdown file.** Ideas live in `.ideas/backlog.md` in your repo. You can read it, edit it, commit it, and every tool shares it.
- **Works with the tools you already use.** It covers Claude Code, Codex, Copilot, Cursor, Windsurf, Kiro and any terminal agent. See the table below.
- **Local and private.** No accounts, no servers, no telemetry. Nothing leaves your machine.

---

## Which tools does it work with?

There are three pieces. Use whichever fits how you work. They all read and write the same file.

| Piece | What it is | Best for |
| --- | --- | --- |
| **Chat plugin** | You type `idea: ...` straight into the AI chat. The plugin catches it before the AI sees it. | Claude Code and Codex users who live in the chat |
| **Sidebar extension** | A panel with a **+** button and your list. Click an idea to send it. | Anyone using VS Code, Cursor, Windsurf or Kiro |
| **`idea` command + MCP server** | A terminal command, plus a tool your agent can call to park ideas itself | Any other terminal agent, and agents that support MCP |

### Tool by tool

| You use… | Park an idea | Send it to the AI later | Uses | Status |
| --- | --- | --- | --- | --- |
| **Claude Code** in the terminal | Type `idea: <your idea>` | Type `idea go 3` | Chat plugin | ✅ Works |
| **Claude Code** in VS Code / Cursor | Type `idea: …` in the Claude panel, **or** click **+** in the sidebar | Click the idea. A Claude Code tab opens with it typed in. Press Enter. | Chat plugin + sidebar | ✅ Works |
| **Codex CLI** | Type `idea: <your idea>` | Type `idea go 3` | Chat plugin | 🧪 Beta: Codex asks you to trust the hook once |
| **Codex** in VS Code / Cursor | Click **+** in the sidebar | Click the idea. It's copied and Codex opens, then you paste it. | Sidebar | ✅ Works |
| **GitHub Copilot Chat** (VS Code) | Click **+** in the sidebar | Click the idea. Copilot Chat opens with it typed in. | Sidebar | ✅ Works |
| **Cursor / Windsurf / Kiro** built-in agent | Click **+** in the sidebar | Click the idea. It's copied, then you paste it into the agent chat. | Sidebar | ✅ Works (paste step) |
| **Any terminal agent** (Aider, Gemini CLI, …) | `idea add "<your idea>"` | `idea pull 3` copies it, or run `claude "$(idea pull 3)"` | `idea` command | ✅ Works |
| **Any agent that supports MCP** | The agent calls `park_idea` when you say "park that" | The agent calls `get_idea` | MCP server | ✅ Works |
| **Lovable, Bolt, Replit, v0** (in the browser) | — | — | — | ❌ Not yet. These sites have no plugin system. A browser extension may come later. |

**Why can't it sit *inside* the Claude Code panel?** Claude Code and the other AI chat panels don't let other
extensions add buttons inside them. So the sidebar sits *next to* the chat, and the chat plugin works
*through* the chat box itself.

---

## Install

### Claude Code (terminal or VS Code panel)

Run this inside Claude Code (v2.1.275 or later):

```text
/plugin install idea-parking-lot --marketplace venkatv/idea-parking-lot
```

On older versions, run `/plugin marketplace add venkatv/idea-parking-lot`, then `/plugin install idea-parking-lot@idea-parking-lot`.
Restart Claude Code, then type `idea help`.

### Codex CLI (beta)

```bash
codex plugin marketplace add venkatv/idea-parking-lot
```

Then open Codex, run `/plugins` and install **Idea Parking Lot for Vibe Coding**. Run `/hooks` once to review and trust the hook.

### VS Code, Cursor, Windsurf, Kiro (sidebar)

Search for **Idea Parking Lot for Vibe Coding** in the Extensions view. Or download the `.vsix` from
[Releases](https://github.com/venkatv/idea-parking-lot/releases) and run **Extensions: Install from VSIX…**.

### `idea` command (any terminal, Node 18+)

```bash
npm install -g idea-parking-lot
```

More detail for each tool, including the MCP setup for Cursor, Windsurf, Kiro and Codex, is in **[docs/setup.md](docs/setup.md)**.

---

## Everyday use

### In the chat (Claude Code, Codex CLI)

| Type this | What happens | Does the AI see it? |
| --- | --- | --- |
| `idea: make the logo bigger` | Saved as the next idea | **No** |
| `park: make the logo bigger` | Same thing | **No** |
| `ideas` | Shows your open ideas | **No** |
| `ideas all` | Also shows done and dropped ideas | **No** |
| `idea go 3` | Sends idea #3 to the AI as your request | Yes, that's the point |
| `idea go 3 but keep it small` | Same, with extra instructions | Yes |
| `idea triage` | Asks the AI to group and rank your open ideas | Yes |
| `idea done 3` · `idea drop 3` · `idea reopen 3` | Updates the status | **No** |
| `idea help` | Shows this list | **No** |

Only messages that **start with** these words are caught. Something like "I have an idea: …" goes to the AI as normal.

### In the sidebar

- **+** parks an idea. The shortcut is `Cmd+Alt+Shift+I` on Mac and `Ctrl+Alt+Shift+I` elsewhere.
- **Click** an idea to send it to your AI. It's typed in, not sent, so you can edit first.
- **Hover** an idea for ✓ done. **Right-click** for *Send to…*, Edit, Drop and Delete.
- **✨** asks your AI to prioritize all your open ideas.
- Select code, right-click, then **Park Selection as Idea** saves the idea with a link to that file and line.

### In the terminal

```bash
idea add "support dark mode"     # park
idea                             # list
idea pull 2                      # print + copy to clipboard + mark as sent
claude "$(idea pull 2)"          # start Claude Code with that idea
idea done 2
```

---

## The backlog file

Everything is stored in `.ideas/backlog.md` at the root of your project:

```markdown
# Idea Parking Lot

- [ ] #1 Add rate limiting to the upload endpoint  <!-- 2026-11-01 chat -->
- [~] #2 Loading state for the save button  <!-- 2026-11-01 vscode -->
  See src/components/SaveButton.tsx:42
- [x] #3 Cache the pricing API  <!-- 2026-10-30 cli -->
```

`[ ]` open · `[~]` sent to a chat · `[x]` done · `[-]` dropped. Indented lines are details.
The comment at the end records when the idea was added and where it came from.

You can edit the file by hand. Anything that isn't an idea line, like your own headings and notes, is left alone.
Commit it if you want your team to see it. Add `.ideas/` to `.gitignore` if you'd rather keep it private.

---

## FAQ

**Does parking an idea use tokens?**
No. In Claude Code and Codex the plugin blocks the message before it reaches the model. The sidebar and the
`idea` command never talk to the AI at all.

**Is my idea sent anywhere?**
No. Everything stays in a file on your computer. One detail: Claude Code still writes blocked messages to its
local session log on disk, as it does for every message. That log stays on your machine and isn't sent to the model.

**Clicking an idea in VS Code opens a *new* Claude Code tab. Can it go into my current chat?**
Not yet. Claude Code only lets other extensions open a new tab with a prompt typed in. The idea is also copied
to your clipboard, so you can paste it into an existing chat instead. In the terminal, `idea go 3` does go into
the current chat.

**Can the AI park ideas by itself?**
Yes, if you install the MCP server. Claude Code gets it automatically with the plugin. Say "park that for later"
and the agent calls `park_idea`. It's told not to park anything without asking you first.

**Where's the file if I'm in a sub-folder?**
The tools walk up to the nearest folder with `.git` or `.ideas`. Set `IDEA_PARKING_LOT_FILE` to use a different path.

---

## Project layout

```text
plugins/idea-parking-lot/    Chat plugin for Claude Code + Codex, the `idea` CLI and the MCP server (also the npm package)
  lib/backlog.js             Reads and writes .ideas/backlog.md (shared by everything)
  scripts/capture.js         The hook that catches "idea: ..." before the AI sees it
  mcp/server.js              MCP server: park_idea, list_ideas, get_idea, update_idea
  bin/idea.js                The `idea` command
vscode-extension/            Sidebar for VS Code, Cursor, Windsurf, Kiro
.claude-plugin/              Claude Code marketplace entry
.agents/plugins/             Codex marketplace entry
test/                        Tests (run: npm test)
```

No dependencies. Everything is plain Node.js, version 18 or later.

## Roadmap

- [ ] Send an idea into the *current* Claude Code chat from the sidebar, if Claude Code adds a way to do it
- [ ] One backlog shared across all your projects, as an option
- [ ] Browser extension for Lovable, Bolt, Replit and v0
- [ ] Better triage: tags and "this week / later" buckets

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
