# Setup, tool by tool

Every option below reads and writes the same file, `.ideas/backlog.md` in your project. Mix and match:
for example, the chat plugin in Claude Code plus the sidebar in VS Code.

> Commands that use `npx idea-parking-lot` need the npm package to be published. Until then, use the
> "from a clone" option.

- [Claude Code (terminal)](#claude-code-terminal)
- [Claude Code in VS Code or Cursor](#claude-code-in-vs-code-or-cursor)
- [Codex CLI](#codex-cli)
- [Codex in VS Code or Cursor](#codex-in-vs-code-or-cursor)
- [GitHub Copilot Chat](#github-copilot-chat)
- [Cursor, Windsurf and Kiro built-in agents](#cursor-windsurf-and-kiro-built-in-agents)
- [Other terminal agents (Aider, Gemini CLI, …)](#other-terminal-agents)
- [MCP server for any agent](#mcp-server-for-any-agent)
- [Browser tools (Lovable, Bolt, Replit, v0)](#browser-tools)
- [Running from a clone](#running-from-a-clone)

---

## Claude Code (terminal)

**What you get:** type `idea: …` to park, `ideas` to list, and `idea go 3` to send one in. The agent can also
park ideas itself through the bundled MCP server.

```text
/plugin install idea-parking-lot --marketplace venkatv/idea-parking-lot
```

On Claude Code older than v2.1.275, run `/plugin marketplace add venkatv/idea-parking-lot`, then
`/plugin install idea-parking-lot@idea-parking-lot`. Restart Claude Code and type `idea help`.

**How it works:** the plugin adds a `UserPromptSubmit` hook. Claude Code runs it on every message *before* the
model sees it. If the message starts with `idea:`, the hook saves it and blocks the message, and you see a short
"Parked idea #4" note. Claude Code doesn't add blocked messages or the note to the model's context.
`idea go 3` isn't blocked. The hook attaches idea #3's text to your message so Claude works on it.

<details>
<summary>Without the plugin (manual hook)</summary>

Install the CLI (`npm install -g idea-parking-lot`), then add this to `~/.claude/settings.json` for all projects
or to `.claude/settings.json` for one project:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "idea hook", "timeout": 10 }] }
    ]
  }
}
```
</details>

## Claude Code in VS Code or Cursor

The Claude Code extension uses the same engine as the terminal, so **install the plugin as above** and
`idea: …` works in the Claude panel too.

For a clickable list, also install the **sidebar extension** (search "Idea Parking Lot for Vibe Coding" in Extensions):

- Click **+** to park an idea.
- Click an idea, and a new Claude Code tab opens with the idea typed in. Review it and press Enter.
- The idea is also copied to your clipboard. Paste it into a chat you already have open if you prefer.

Put the sidebar next to Claude:
- **VS Code:** right-click the lightbulb icon → *Move To* → *Secondary Side Bar*.
- **Cursor:** keep it in the left side bar. Cursor reserves the right side for its own agent.

## Codex CLI

> 🧪 Beta. Codex added hooks recently and reads this plugin's hook file. Please report anything odd.

```bash
codex plugin marketplace add venkatv/idea-parking-lot
```

Start Codex, run `/plugins`, and install **Idea Parking Lot for Vibe Coding**. Then run `/hooks` and **trust** the
`UserPromptSubmit` hook. Codex skips hooks you haven't reviewed. Start a new session and type `idea help`.

<details>
<summary>Without the plugin (manual hook + MCP)</summary>

Install the CLI (`npm install -g idea-parking-lot`), then create `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "idea hook" }] }
    ]
  }
}
```

And in `~/.codex/config.toml`:

```toml
[mcp_servers.idea-parking-lot]
command = "idea"
args = ["mcp"]
```

Run `/hooks` in Codex to trust the hook.
</details>

## Codex in VS Code or Cursor

The Codex extension doesn't let other extensions type into its chat box, so the sidebar does the next best thing:

1. Install the **sidebar extension**.
2. Click an idea. It's copied to your clipboard and the Codex panel opens.
3. Paste with Cmd/Ctrl+V and press Enter.

If you have both Claude Code and Codex installed, set **Settings → Idea Parking Lot → Send To** to `codex`, or
right-click an idea and choose **Send to…**.

## GitHub Copilot Chat

Install the **sidebar extension**. Clicking an idea opens Copilot Chat with the idea typed in.
Set **Send To** to `copilot` if you also have Claude Code or Codex installed.

To let Copilot's agent park ideas itself, add the [MCP server](#mcp-server-for-any-agent) in `.vscode/mcp.json`.

## Cursor, Windsurf and Kiro built-in agents

These editors are built on VS Code and install extensions from Open VSX, so the **sidebar extension** works in all of them.
Their own agent chats can't be pre-filled by other extensions, so clicking an idea **copies it**. Paste it into
the agent chat. Set **Send To** to `clipboard` to make this the default.

For the agent to park ideas itself, add the [MCP server](#mcp-server-for-any-agent):

| Editor | MCP config file |
| --- | --- |
| Cursor | `.cursor/mcp.json` in the project, or `~/.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Kiro | `.kiro/settings/mcp.json` in the project, or `~/.kiro/settings/mcp.json` |

## Other terminal agents

The `idea` command works next to any agent: Aider, Gemini CLI, OpenCode, Amp, and others.

```bash
npm install -g idea-parking-lot

idea add "support dark mode"     # park it (any terminal tab)
idea                             # list open ideas
idea pull 3                      # print + copy to clipboard + mark as sent
idea done 3
idea triage                      # print a "please prioritize these" prompt
```

Start an agent with an idea already in it:

```bash
claude "$(idea pull 3)"
codex "$(idea pull 3)"
gemini -i "$(idea pull 3)"
```

In VS Code you can also right-click an idea → **Send to… → Active terminal**. It's typed into the terminal where
your agent is running, without pressing Enter.

## MCP server for any agent

The MCP server lets an agent park and read ideas when you ask, like "park that for later" or "what ideas do I have?".
It returns short titles only, so your context stays small.

| Tool | What it does |
| --- | --- |
| `park_idea` | Save an idea (`text`, optional `details`) |
| `list_ideas` | One-line titles (`include`: active, open, done, all…) |
| `get_idea` | Full text of one idea |
| `update_idea` | Set status: open, pulled, done, dropped |

Most agents use this shape. Claude Desktop, Cursor, Windsurf, Kiro and Gemini CLI all accept it:

```json
{
  "mcpServers": {
    "idea-parking-lot": {
      "command": "npx",
      "args": ["-y", "idea-parking-lot", "mcp"]
    }
  }
}
```

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "idea-parking-lot": { "type": "stdio", "command": "npx", "args": ["-y", "idea-parking-lot", "mcp"] }
  }
}
```

Claude Code without the plugin:

```bash
claude mcp add idea-parking-lot -- npx -y idea-parking-lot mcp
```

**Ideas landing in the wrong folder?** Some editors start MCP servers outside your project. Add
`"env": { "IDEA_PARKING_LOT_FILE": "/absolute/path/to/project/.ideas/backlog.md" }` to the server config.

## Browser tools

Lovable, Bolt, Replit and v0 run in the browser and don't offer a plugin system, so there's nothing to hook into
yet. For now, keep the sidebar or the `idea` command open next to them and paste ideas in. A browser extension is
on the roadmap. Contributions welcome.

## Running from a clone

Before the npm package is published, or if you want to hack on it:

```bash
git clone https://github.com/venkatv/idea-parking-lot
cd idea-parking-lot
npm test
```

- CLI: `node plugins/idea-parking-lot/bin/idea.js` (or `npm link` inside `plugins/idea-parking-lot`).
- Claude Code plugin from disk: `/plugin marketplace add /path/to/idea-parking-lot`.
- MCP server: `"command": "node", "args": ["/path/to/idea-parking-lot/plugins/idea-parking-lot/bin/idea.js", "mcp"]`.
- VS Code extension: open `vscode-extension/` in VS Code and press F5, or `npm run package:vscode` and install the `.vsix`.
