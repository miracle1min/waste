import { spawn } from "node:child_process";

// Vercel dev serves on port 3000 by default.
// Vite needs to run on a different port (5173) as a backend.
// Vercel dev will proxy Vite requests automatically via the devCommand.
// The PORT env var is set by vercel dev to tell us which port to use.
const port = process.env.PORT || "5173";
const command = `npx vite --host 0.0.0.0 --port ${port}`;

console.log(`Starting Vite for Vercel dev on port ${port}`);

const vite = spawn(command, {
  stdio: "inherit",
  shell: true,
});

vite.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
