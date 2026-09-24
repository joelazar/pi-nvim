# pi-nvim

A [pi](https://github.com/earendil-works/pi-mono) extension for opening [Neovim](https://neovim.io/) from inside pi. Pi's TUI suspends, nvim takes over the terminal, and pi comes back when nvim exits. In a git repo with uncommitted changes, it opens the [snacks.nvim](https://github.com/folke/snacks.nvim) `git_status` picker directly, so you land on a changed file instead of the dashboard.

Looking for code review of pi's changes? Use [pi-tuicr](https://github.com/joelazar/pi-tuicr).

## Features

- `/nvim` slash command and `Ctrl+Shift+E` shortcut to open nvim from pi.
- In a dirty git repo, nvim starts on `Snacks.picker.git_status()` instead of the dashboard.
- Clean TUI handoff. Pi stops, the screen is cleared, nvim runs with full terminal control, and pi restarts on exit without leftover escape sequences.

## Requirements

- [pi](https://github.com/earendil-works/pi-mono)
- [neovim](https://neovim.io/) on `PATH`
- [snacks.nvim](https://github.com/folke/snacks.nvim), only if you want the auto git picker. Without it, nvim still opens on dirty repos; you just get a harmless error from the unknown lua call.

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

## How it works

The extension uses pi's `ui.custom` overlay to take over the screen:

```text
/nvim or Ctrl+Shift+E
  → ui.custom(...)
    → tui.stop()                    -- suspend pi TUI
    → clear screen
    → spawnSync("nvim", args, { stdio: "inherit" })
    → tui.start()                   -- restore pi TUI
    → tui.requestRender(true)
```

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
