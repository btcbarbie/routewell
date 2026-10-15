// Copies Bryntum Calendar's ready-made browser files into public/vendor so the app loads them directly.
// Bundling Bryntum's 5 MB module made production builds take minutes and over 7 GB of memory.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const from = "node_modules/@bryntum/calendar";
const to = "public/vendor/bryntum";
if (!existsSync(from)) {
  console.log("Bryntum Calendar isn't installed; skipping copy.");
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const f of ["calendar.module.js", "calendar.css", "stockholm-light.css"]) cpSync(`${from}/${f}`, `${to}/${f}`);
cpSync(`${from}/fontawesome`, `${to}/fontawesome`, { recursive: true });
console.log("Copied Bryntum Calendar files to public/vendor/bryntum.");
