## Cursor setup (performance + lower tokens)

This repo is configured to use project-level Cursor files.

### 1) Add Cursor ignore files

Due to dotfile creation restrictions in this environment, create these two files manually at repo root:

- `.cursorignore` (hard block: files AI cannot read at all)
- `.cursorindexingignore` (soft block: files not indexed, but you can still reference manually)

Suggested contents live in:

- `cursorignore.template`
- `cursorindexingignore.template`

Rename them to the dotfile names above.

### 2) Open the workspace

Open `whatsapp-bot-firebase.code-workspace` so repo settings apply.

### 3) Caveman mode (manual prompt snippet)

Keep this snippet handy and paste at top of your message when you want ultra-short answers:

```
CAVEMAN MODE.
Short. No fluff. No apologies. No extra explanation.
Bullets only.
If code needed: only code.
If question needed: ask 1 question max.
```
