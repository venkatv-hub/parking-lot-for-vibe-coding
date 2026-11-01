# Contributing

Thanks for helping! This project is small on purpose. Plain Node.js, no dependencies, one Markdown file as the data store.

## Getting started

```bash
git clone https://github.com/venkatv/idea-parking-lot
cd idea-parking-lot
npm test
```

## Where things live

| Change | Edit |
| --- | --- |
| How the backlog file is read or written | `plugins/idea-parking-lot/lib/backlog.js`, then run `npm run sync` |
| What you can type in the chat (`idea: …`, `ideas`, …) | `plugins/idea-parking-lot/scripts/capture.js` |
| Agent tools | `plugins/idea-parking-lot/mcp/server.js` |
| The `idea` command | `plugins/idea-parking-lot/bin/idea.js` |
| The sidebar | `vscode-extension/extension.js` and `vscode-extension/package.json` |

`vscode-extension/lib/backlog.js` is a **copy**. Always edit the one in `plugins/` and run `npm run sync`.
`npm test` fails if the copy is out of date.

## Trying your changes

- **Claude Code:** `/plugin marketplace add /path/to/your/clone`, then install the plugin, or reinstall it after changes.
- **VS Code:** open `vscode-extension/` and press **F5** to launch a test window.
- **CLI:** `node plugins/idea-parking-lot/bin/idea.js`.

## Ground rules

- Keep the backlog format readable by humans. If you add a field, older files must still work.
- Never send idea text to the AI unless the user asked for it (`idea go`, a click, `idea triage`).
- No network calls and no telemetry.
- Add a test in `test/all.test.js` for behaviour changes.

## Releasing (maintainers)

1. Bump `version` in `plugins/idea-parking-lot/package.json`, both plugin manifests, `.claude-plugin/marketplace.json`, and `vscode-extension/package.json`. Update `CHANGELOG.md`.
2. npm: `cd plugins/idea-parking-lot && npm publish`.
3. VS Code Marketplace: `cd vscode-extension && npx @vscode/vsce publish`.
4. Open VSX (for Cursor, Windsurf, Kiro): `cd vscode-extension && npx ovsx publish -p <token>`.
5. Tag the release and attach the `.vsix`.
