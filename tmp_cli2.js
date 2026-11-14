require("dotenv").config();
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");
const path = require("path");

function resolveOpencodeBin() {
  if (process.env.OPENCODE_BIN) return process.env.OPENCODE_BIN;
  if (process.platform === "win32") {
    const candidate = path.join(path.dirname(process.execPath), "node_modules", "opencode-ai", "bin", "opencode.exe");
    if (fs.existsSync(candidate)) return candidate;
  }
  return "opencode";
}

const dir = path.join(os.tmpdir(), "messanger-ai-opencode");
fs.mkdirSync(dir, { recursive: true });
const promptText = "You are chatting through Facebook Messenger. Reply in plain text only, no markdown. Be concise and friendly.\n\nUser: Say hi in 3 words.";
const args = ["run", "--format", "json", "--dir", dir, promptText];
const child = spawn(resolveOpencodeBin(), args, { cwd: dir, env: { ...process.env, NO_COLOR: "1" }, windowsHide: true });
let out = "", err = "";
child.stdout.on("data", d => out += d);
child.stderr.on("data", d => err += d);
child.on("error", e => console.log("spawn error", e.message));
child.on("close", code => {
  const texts = [];
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { const e = JSON.parse(line); if (e.type === "text" && e.part?.text) texts.push(e.part.text); } catch {}
  }
  console.log("exit", code, "text:", JSON.stringify(texts.join("").trim()));
  if (!texts.length) console.log("stderr:", err.slice(0, 300));
});
