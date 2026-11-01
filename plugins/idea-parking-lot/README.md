# idea-parking-lot

**Idea Parking Lot for Vibe Coding.** Park ideas while you build with AI, and send them in later. This package contains:

- **`idea` command:** `idea add "…"`, `idea`, `idea pull 3`, `idea done 3`
- **MCP server:** `idea mcp` (tools: `park_idea`, `list_ideas`, `get_idea`, `update_idea`)
- **Chat hook:** `idea hook`. In Claude Code or Codex, typing `idea: …` saves the idea without sending it to the AI.

Ideas are stored in `.ideas/backlog.md` in your project.

```bash
npm install -g idea-parking-lot
idea add "add rate limiting to uploads"
claude "$(idea pull 1)"
```

Claude Code plugin (catches `idea: …` in the chat and adds the MCP server):

```text
/plugin install idea-parking-lot --marketplace venkatv/idea-parking-lot
```

Full docs, including the Claude Code / Codex plugin and the VS Code sidebar:
https://github.com/venkatv/idea-parking-lot
