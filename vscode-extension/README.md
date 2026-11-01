# Idea Parking Lot for Vibe Coding

Works in VS Code, Cursor, Windsurf and Kiro.

Got an idea while your AI agent is busy? Click **+**, type it, and keep going.
The idea is saved to `.ideas/backlog.md` in your project. **Your AI never sees it** until you click it.

## How to use it

1. Open the **Idea Parking Lot** view (lightbulb icon in the activity bar).
2. Click **+** (or press `Cmd+Alt+Shift+I` / `Ctrl+Alt+Shift+I`) and type your idea.
3. Later, **click an idea** to send it to your AI. It is typed in for you but not sent, so you can edit it first.
4. Hover an idea to mark it ✓ done. Right-click for more: **Send to…**, Edit, Drop, Delete.
5. Click ✨ to ask your AI to group and rank all your open ideas.

You can also select code, right-click, and choose **Park Selection as Idea**.

## Where does a clicked idea go?

| Your AI | What happens |
| --- | --- |
| Claude Code extension | Opens a Claude Code tab with the idea typed in. Press Enter to send. |
| Codex extension | Copies the idea and opens Codex. Paste with Cmd/Ctrl+V. |
| GitHub Copilot Chat | Opens Copilot Chat with the idea typed in. |
| Any agent in the terminal (Claude Code CLI, Codex CLI, Aider…) | Choose **Send to… → Active terminal**. The idea is typed in, not sent. |
| Cursor, Windsurf or Kiro's own agent | Copied to the clipboard. Paste it into the chat. |

The default is **auto**: the first one installed of Claude Code, Codex, then Copilot. Change it in Settings → `ideaParkingLot.sendTo`.

## Putting it next to your chat

- **VS Code:** right-click the Idea Parking Lot icon → *Move To* → *Secondary Side Bar* to put it on the right, next to Claude Code or Copilot.
- **Cursor:** the right side bar is reserved for Cursor's agent, so keep it on the left.

## Works with the rest of the project

The same `.ideas/backlog.md` file is used by the Claude Code / Codex plugin (type `idea: ...` in the chat) and the `idea` command-line tool. See the main README:
https://github.com/venkatv/idea-parking-lot
