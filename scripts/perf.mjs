// Lighthouse mobile gate. Serves dist/ on an ephemeral port with Brotli (as Cloudflare does),
// audits / and /es/, writes reports to .perf/, and exits non-zero on any regression.
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { brotliCompressSync } from "node:zlib";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const out = join(root, ".perf");

const GATE = { performance: 1, lcp: 1500, cls: 0, tbt: 50 };
const PAGES = ["/", "/es/"];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(dist, path.endsWith("/") ? path + "index.html" : path));
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  try {
    let body = await readFile(file);
    const type = TYPES[extname(file)] || "application/octet-stream";
    const headers = {
      "Content-Type": type,
      "Cache-Control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
    };
    if (/text|javascript|xml/.test(type) && /\bbr\b/.test(req.headers["accept-encoding"] || "")) {
      body = brotliCompressSync(body);
      headers["Content-Encoding"] = "br";
    }
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
await mkdir(out, { recursive: true });

let failed = false;
try {
  for (const page of PAGES) {
    const result = await lighthouse(
      base + page,
      { port: chrome.port, output: ["html", "json"], logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] },
      undefined
    );
    const lhr = result.lhr;
    const slug = page === "/" ? "en" : page.replace(/\//g, "");
    await writeFile(join(out, `${slug}.html`), result.report[0]);
    await writeFile(join(out, `${slug}.json`), result.report[1]);

    const a = lhr.audits;
    const m = {
      performance: lhr.categories.performance.score,
      accessibility: lhr.categories.accessibility.score,
      bestPractices: lhr.categories["best-practices"].score,
      seo: lhr.categories.seo.score,
      lcp: Math.round(a["largest-contentful-paint"].numericValue),
      fcp: Math.round(a["first-contentful-paint"].numericValue),
      cls: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)),
      tbt: Math.round(a["total-blocking-time"].numericValue),
    };
    const fails = [];
    if (m.performance < GATE.performance) fails.push(`performance ${m.performance * 100} < ${GATE.performance * 100}`);
    if (m.lcp > GATE.lcp) fails.push(`LCP ${m.lcp}ms > ${GATE.lcp}ms`);
    if (m.cls > GATE.cls) fails.push(`CLS ${m.cls} > ${GATE.cls}`);
    if (m.tbt > GATE.tbt) fails.push(`TBT ${m.tbt}ms > ${GATE.tbt}ms`);
    if (fails.length) failed = true;

    console.log(
      `${fails.length ? "FAIL" : "ok  "}  ${page.padEnd(5)} perf ${m.performance * 100}  a11y ${m.accessibility * 100}  bp ${m.bestPractices * 100}  seo ${m.seo * 100}  ` +
        `FCP ${m.fcp}ms  LCP ${m.lcp}ms  CLS ${m.cls}  TBT ${m.tbt}ms`
    );
    fails.forEach((f) => console.log("      " + f));
  }
} finally {
  await chrome.kill();
  server.close();
}

console.log(`reports in .perf/`);
if (failed) process.exit(1);
