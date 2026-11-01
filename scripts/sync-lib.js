#!/usr/bin/env node
'use strict';
// The VS Code extension ships its own copy of the shared library.
//   node scripts/sync-lib.js          copy plugins/idea-parking-lot/lib/backlog.js into the extension
//   node scripts/sync-lib.js --check  fail if the copy is out of date (used by tests and CI)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'plugins/idea-parking-lot/lib/backlog.js');
const dest = path.join(root, 'vscode-extension/lib/backlog.js');
const same = fs.existsSync(dest) && fs.readFileSync(src, 'utf8') === fs.readFileSync(dest, 'utf8');

if (process.argv.includes('--check')) {
  if (!same) {
    console.error('vscode-extension/lib/backlog.js is out of date. Run: npm run sync');
    process.exit(1);
  }
  console.log('Library copy is up to date.');
} else {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
}
