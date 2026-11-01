---
name: idea-parking-lot
description: Use when the user wants to save an idea for later ("park this", "add to my ideas", "remind me later", "not now"), asks what ideas they have parked, or when you notice a worthwhile improvement that is outside the current task.
---

# Idea Parking Lot

The user keeps side ideas in `.ideas/backlog.md` so they don't derail the current task or fill up the chat.

- To save an idea, call the `park_idea` tool with one clear sentence. Do not start working on it.
- If you notice something worth doing that is out of scope, finish the current task first, then offer to park it. Don't park things without asking.
- To see ideas, call `list_ideas`. It returns short titles only. Call `get_idea` for the details of one.
- When the user asks you to work on an idea, call `update_idea` with status `pulled`. When it's finished, set it to `done`.
- Don't read the whole backlog file into context unless the user asks you to.

The user can also manage ideas without you. Typing `idea: ...` parks an idea, and `ideas` lists them. These never reach you.
