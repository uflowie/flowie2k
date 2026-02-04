import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
};

const port = Number(getArg("--port")) || 4173;
const persistRoot =
  getArg("--persist") ?? path.join(process.cwd(), ".wrangler", "e2e");
const schemaFile = getArg("--schema") ?? "schema.sql";

const run = (command, commandArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });

if (existsSync(persistRoot)) {
  rmSync(persistRoot, { recursive: true, force: true });
}

await run("npx", [
  "wrangler",
  "d1",
  "execute",
  "MUSIC_DB",
  "--local",
  "--persist-to",
  persistRoot,
  "--file",
  schemaFile,
]);

const devServer = spawn(
  "npm",
  ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)],
  {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      CF_PERSIST_STATE: persistRoot,
    },
  },
);

devServer.on("exit", (code) => {
  process.exit(code ?? 0);
});
