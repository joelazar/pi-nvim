# pi-nvim

A [pi](https://github.com/badlogic/pi-mono) extension for opening [Neovim](https://neovim.io/) from inside pi. Pi's TUI suspends, nvim takes over the terminal, and pi comes back when nvim exits. In a git repo with uncommitted changes, it opens the [snacks.nvim](https://github.com/folke/snacks.nvim) `git_status` picker directly, so you land on a changed file instead of the dashboard.

There's also an optional bridge for sending text back the other way: if your nvim setup writes a JSON payload to the path pi-nvim passes in, the `text` field ends up in pi's prompt editor when nvim exits. Pairs well with [agent-review.nvim](https://github.com/joelazar/agent-review.nvim), which speaks this protocol out of the box and lets you leave line/range/file comments in nvim and send them back as a prompt.

## Features

- `/nvim` slash command and `Ctrl+Shift+E` shortcut to open nvim from pi.
- In a dirty git repo, nvim starts on `Snacks.picker.git_status()` instead of the dashboard.
- Clean TUI handoff. Pi stops, the screen is cleared, nvim runs with full terminal control, and pi restarts on exit without leftover escape sequences.
- Optional agent-review handoff. Three env vars (`AGENT_REVIEW_EXPORT_PATH`, `AGENT_REVIEW_EXPORT_TOKEN`, `AGENT_REVIEW_EXPORT_ROOT`) are passed to nvim. Write a JSON payload with the matching token and pi-nvim drops the `text` into your input editor on return.

## Requirements

- [pi](https://github.com/badlogic/pi-mono)
- [neovim](https://neovim.io/) on `PATH`
- [snacks.nvim](https://github.com/folke/snacks.nvim), only if you want the auto git picker. Without it, nvim still opens on dirty repos; you just get a harmless error from the unknown lua call.
- [agent-review.nvim](https://github.com/joelazar/agent-review.nvim), optional, for the review-notes-to-prompt bridge.

## Install

From npm:

```bash
pi install npm:pi-nvim
```

From git:

```bash
pi install git:github.com/joelazar/pi-nvim
```

Or try it without installing:

```bash
pi -e git:github.com/joelazar/pi-nvim
```

## Usage

Inside pi, type `/nvim` and hit enter, or press `Ctrl+Shift+E`. Pi suspends and nvim launches in the current working directory.

| Situation                 | What happens                               |
| ------------------------- | ------------------------------------------ |
| Not a git repo            | `nvim` opens with no arguments             |
| Git repo, clean tree      | `nvim` opens with no arguments             |
| Git repo, dirty tree      | `nvim -c "lua Snacks.picker.git_status()"` |
| Not running interactively | Error toast: "Requires interactive mode"   |

When you quit nvim, pi's TUI restores and re-renders.

## agent-review handoff (optional)

Every time pi-nvim spawns nvim, it creates a per-session temp directory and sets three environment variables in nvim's environment:

| Variable                    | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| `AGENT_REVIEW_EXPORT_PATH`  | Absolute path your nvim command should write the export to                   |
| `AGENT_REVIEW_EXPORT_TOKEN` | Random per-session token. Pi-nvim only accepts payloads whose token matches. |
| `AGENT_REVIEW_EXPORT_ROOT`  | The pi cwd, in case your command needs project context                       |

### With agent-review.nvim

Install the plugin and you're done. It already reads these env vars and flushes the export on `VimLeavePre`:

```lua
{
  "joelazar/agent-review.nvim",
  dependencies = { "folke/snacks.nvim" },
  opts = {},
}
```

Workflow: open nvim from pi, drop comments with `:AgentReviewComment` / `:AgentReviewFileComment`, quit nvim. Pi comes back with the generated prompt already in the input editor.

### Rolling your own

The extension doesn't care who writes the file. Any nvim command that produces JSON like this works:

```json
{
  "version": 1,
  "token": "<value of AGENT_REVIEW_EXPORT_TOKEN>",
  "root": "<value of AGENT_REVIEW_EXPORT_ROOT>",
  "text": "Prompt or review comments to send back to pi"
}
```

When nvim exits, pi-nvim:

1. Reads the file.
2. Checks that the token matches. If it doesn't, the payload is dropped.
3. Calls `ui.setEditorText(text)` so the content lands in the pi input editor, ready to send.
4. Shows a toast: _"Loaded agent-review comments into the input editor"_.
5. Removes the temp directory.

If no file is written, or the token doesn't match, pi-nvim does nothing. Nvim was just an editor in that case.

### Minimal nvim-side example

```lua
-- inside your nvim config
vim.api.nvim_create_user_command("AgentReviewDump", function(opts)
  local path  = vim.env.AGENT_REVIEW_EXPORT_PATH
  local token = vim.env.AGENT_REVIEW_EXPORT_TOKEN
  local root  = vim.env.AGENT_REVIEW_EXPORT_ROOT
  if not path or not token then
    vim.notify("Not running under pi-nvim", vim.log.levels.WARN)
    return
  end
  local text = opts.args ~= "" and opts.args
    or table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), "\n")
  local payload = vim.fn.json_encode({
    version = 1,
    token   = token,
    root    = root,
    text    = text,
  })
  local f = assert(io.open(path, "w"))
  f:write(payload)
  f:close()
  vim.cmd("qa!")
end, { nargs = "?" })
```

Run `:AgentReviewDump` (or `:AgentReviewDump some prompt`) inside nvim. Pi will pick up the text on return.

## How it works

The extension uses pi's `ui.custom` overlay to take over the screen:

```text
/nvim or Ctrl+Shift+E
  → ui.custom(...)
    → tui.stop()                    -- suspend pi TUI
    → clear screen
    → spawnSync("nvim", args, { stdio: "inherit", env: { + AGENT_REVIEW_* } })
    → readAgentReviewExport()       -- if the export file exists & token matches
    → tui.start()                   -- restore pi TUI
    → ui.setEditorText(text)        -- if there was an export
    → tui.requestRender(true)
```

The temp dir and token are created fresh for each invocation and removed in a `finally` block, so nothing leaks between sessions.

## Development

```bash
npm install
npm run typecheck
```

Test locally without publishing:

```bash
pi -e ./index.ts
```

## License

MIT. See [LICENSE](./LICENSE).
