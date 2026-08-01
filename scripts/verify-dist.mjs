import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "dist/index.html",
  "dist/src/app.js",
  "dist/src/runtime.js",
  "dist/src/styles.css",
  "dist/src/telegram-host.js"
];

for (const file of requiredFiles) {
  await access(resolve(root, file));
}

const html = await readFile(resolve(root, "dist/index.html"), "utf8");
if (!html.includes('<script type="module" src="./src/app.js"></script>')) {
  throw new Error("dist/index.html does not reference the application entry point");
}

console.log("Verified dist/ contract");
