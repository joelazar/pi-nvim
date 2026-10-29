import { spawnSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

function shouldOpenGitPicker(cwd: string): boolean {
  const isGitRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd,
    encoding: "utf8",
  });

  if (isGitRepo.status !== 0 || isGitRepo.stdout.trim() !== "true") {
    return false;
  }

  const hasHead = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd,
    stdio: "ignore",
  });

  if (hasHead.status !== 0) {
    return false;
  }

  const status = spawnSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd,
    encoding: "utf8",
  });

  return status.status === 0 && status.stdout.trim().length > 0;
}

function nvimArgs(cwd: string): string[] {
  return shouldOpenGitPicker(cwd) ? ["-c", "lua Snacks.picker.git_status()"] : [];
}

function openRexLayer(ctx: ExtensionContext): string | null {
  const layer = {
    bounds: [0, 0, 1, 1],
    focus: true,
    layout: {
      block: {
        flavor: "com.superlogical.terminal.shell",
        label: "nvim",
        options: { command: ["nvim", ...nvimArgs(ctx.cwd)], cwd: ctx.cwd },
      },
    },
  };
  const result = spawnSync(
    "rex",
    ["api", "call", "-s", process.env.REX_SESSION!, "session.new_layer", JSON.stringify(layer)],
    { encoding: "utf8" },
  );
  if (result.error) return result.error.message;
  if (result.status !== 0) return result.stderr.trim() || `exit ${result.status}`;
  return null;
}

async function runNvim(ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("Requires interactive mode", "error");
    return;
  }

  if (process.env.REX_SESSION) {
    const error = openRexLayer(ctx);
    if (!error) return;
    ctx.ui.notify(`Rex layer failed, running inline: ${error}`, "warning");
  }

  await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
    tui.stop();
    process.stdout.write("\x1b[2J\x1b[H");

    const args = nvimArgs(ctx.cwd);
    const result = spawnSync("nvim", args, { stdio: "inherit", cwd: ctx.cwd });

    tui.start();
    tui.requestRender(true);
    done(result.status);
    return { render: () => [], invalidate: () => {} };
  });
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("nvim", {
    description: "Open nvim",
    handler: async (_args, ctx) => {
      await runNvim(ctx);
    },
  });

  pi.registerShortcut("ctrl+shift+e", {
    description: "Open nvim",
    handler: async (ctx) => {
      await runNvim(ctx);
    },
  });
}
