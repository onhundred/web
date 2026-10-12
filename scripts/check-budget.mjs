// Byte budget gate for dist/. Exits non-zero when any budget is exceeded.
import { readFile, readdir } from "node:fs/promises";
import { brotliCompressSync, constants } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

const BUDGET = {
  htmlBrotli: 20 * 1024,
  jsBrotli: 3 * 1024,
  fontsTotal: 80 * 1024,
  maxPreloads: 2,
};

const br = (buf) =>
  brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const kb = (n) => (n / 1024).toFixed(1) + "KB";

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
  );
  return nested.flat();
};

const files = await walk(dist);
const rows = [];
let failed = false;
const check = (label, value, limit, fmt = kb) => {
  const ok = value <= limit;
  if (!ok) failed = true;
  rows.push(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(34)} ${fmt(value).padStart(8)} / ${fmt(limit)}`);
};

for (const f of files.filter((f) => f.endsWith(".html"))) {
  const html = await readFile(f);
  const rel = f.slice(dist.length);
  check(`html+css (br) ${rel}`, br(html), BUDGET.htmlBrotli);
  const text = html.toString();
  const preloads = (text.match(/rel="?preload"?/g) || []).length;
  check(`font preloads ${rel}`, preloads, BUDGET.maxPreloads, String);
  if (/<img\b/i.test(text.slice(0, text.indexOf('class="states'))))
    (failed = true), rows.push(`FAIL  raster above the fold in ${rel}`);
}

let js = 0;
for (const f of files.filter((f) => f.endsWith(".js"))) js += br(await readFile(f));
check("js total (br)", js, BUDGET.jsBrotli);

let fonts = 0;
for (const f of files.filter((f) => f.endsWith(".woff2"))) fonts += (await readFile(f)).length;
check("fonts total (woff2)", fonts, BUDGET.fontsTotal);

console.log("budget\n" + rows.join("\n"));
if (failed) {
  console.error("budget exceeded");
  process.exit(1);
}
