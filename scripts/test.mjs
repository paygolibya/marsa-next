// Cross-platform test runner wrapper. Two things npm scripts can't express
// portably (bash vs. cmd.exe vs. PowerShell) are handled here instead:
// setting TSX_TSCONFIG_PATH so JSX-containing test files compile with the
// automatic runtime (the main tsconfig.json's "jsx": "preserve" is correct
// for Next.js's own SWC build but breaks tsx's esbuild-based transform), and
// passing the test glob as a literal argv entry so node:test's own glob
// matching runs it instead of the shell's.
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "src/**/*.test.ts", "src/**/*.test.tsx"],
  {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, TSX_TSCONFIG_PATH: "./tsconfig.test.json" },
  }
);

process.exit(result.status ?? 1);
