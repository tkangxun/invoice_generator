import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = port;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

console.log(`Migrating database, then starting Next.js on 0.0.0.0:${port}`);
await run("npx", ["prisma", "migrate", "deploy"]);
const server = spawn(
  "npx",
  ["next", "start", "--hostname", "0.0.0.0", "--port", port],
  { stdio: "inherit", shell: true, env: process.env }
);
server.on("exit", (code) => process.exit(code ?? 1));
