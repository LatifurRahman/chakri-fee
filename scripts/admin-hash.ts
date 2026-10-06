import { randomBytes, scryptSync } from "node:crypto";
if (!process.stdin.isTTY) throw new Error("Run in an interactive terminal.");
process.stdout.write("Password (input hidden): ");
process.stdin.setRawMode(true);
process.stdin.resume();
const password = await new Promise<string>((resolve, reject) => {
  let input = "";
  const handler = (chunk: Buffer) => {
    for (const char of chunk.toString("utf8")) {
      if (char === "\u0003") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        reject(new Error("Cancelled"));
        return;
      }
      if (char === "\r" || char === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", handler);
        process.stdout.write("\n");
        resolve(input);
        return;
      }
      if (char === "\u007f" || char === "\b") input = input.slice(0, -1);
      else input += char;
    }
  };
  process.stdin.on("data", handler);
});
if (password.length < 14) throw new Error("Use at least 14 characters.");
const salt = randomBytes(16).toString("hex");
console.log(
  `ADMIN_PASSWORD_HASH=${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
);
