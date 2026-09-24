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

async function runNvim(ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("Requires interactive mode", "error");
    return;
  }

  await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
    tui.stop();
    process.stdout.write("\x1b[2J\x1b[H");

    const args = shouldOpenGitPicker(ctx.cwd) ? ["-c", "lua Snacks.picker.git_status()"] : [];
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
