import { spawn } from "node:child_process";

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
