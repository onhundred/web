// Static site build: renders src/index.html once per locale into dist/.
// Zero dependencies; Node 20+. Loop and experiment rules live in app/lib/protocol.mjs.
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile, copyFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS, checkPublic, esc, pickText, publicView, renderGrid } from "../app/lib/protocol.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");
const seedDir = join(root, "app", "seed");

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 8);
const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));

const minifyCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .replace(/:\s+/g, ":")
    .replace(/;}/g, "}")
    .trim();
const minifyJs = (js) =>
  js
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
const minifyHtml = (html) => html.replace(/>\s*\n\s*</g, "><").replace(/\n\s*/g, " ").trim();

// Production (Cloudflare Pages on the production branch) renders only the published log.
// Pages keeps the previous deploy live when a build fails, so visitors never see sample data.
async function loadLog() {
  const production =
    process.env.CF_PAGES === "1" && process.env.CF_PAGES_BRANCH === (process.env.PRODUCTION_BRANCH || "main");
  const url = process.env.LOG_URL;
  if (!url) {
    if (production) throw new Error("LOG_URL is not set. Production builds render the published log, never sample data.");
    const [meta, loops, experiments] = await Promise.all(
      ["log.json", "loops.json", "experiments.json"].map((f) => readJson(join(seedDir, f)))
    );
    return publicView({ meta, loops, experiments });
  }
  const endpoint = url.replace(/\/$/, "") + "/public.json";
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${endpoint} answered ${res.status}. The build stops so the live site stays as it is.`);
  const view = await res.json();
  const issues = checkPublic(view);
  if (issues.length) throw new Error(`${endpoint} failed validation:\n  ${issues.join("\n  ")}`);
  return view;
}

async function buildAssets() {
  const out = join(dist, "assets");
  await mkdir(join(out, "fonts"), { recursive: true });
  const fontsDir = join(src, "assets", "fonts");
  const fontMap = {};
  for (const name of await readdir(fontsDir)) {
    const buf = await readFile(join(fontsDir, name));
    if (name.endsWith(".woff2")) {
      const hashed = name.replace(/\.woff2$/, `.${hash(buf)}.woff2`);
      await writeFile(join(out, "fonts", hashed), buf);
      fontMap[name] = `assets/fonts/${hashed}`;
    } else {
      await copyFile(join(fontsDir, name), join(out, "fonts", name));
    }
  }

  const js = minifyJs(await readFile(join(src, "assets", "js", "grid.js"), "utf8"));
  const jsName = `grid.${hash(js)}.js`;
  await writeFile(join(out, jsName), js);

  const css = minifyCss(await readFile(join(src, "assets", "css", "site.css"), "utf8"));
  for (const n of css.matchAll(/\{\{font:([\w.-]+)\}\}/g))
    if (!fontMap[n[1]]) throw new Error(`Unknown font in CSS: ${n[1]}`);

  return { css, jsUrl: `assets/${jsName}`, fontMap };
}

// Open experiments first, then concluded ones, newest first.
const sortExperiments = (list) =>
  [...list].sort((a, b) => {
    if (!a.conclusion !== !b.conclusion) return a.conclusion ? 1 : -1;
    if (a.conclusion) return a.conclusion.at < b.conclusion.at ? 1 : -1;
    return a.code < b.code ? -1 : 1;
  });

function statusText(t, e) {
  const s = t.experiments.status;
  if (e.status === "concluded") return `${s.concluded} · ${t.experiments.conclusion[e.conclusion.hypothesis]}`;
  if (!e.stage) return s[e.status];
  return `${s[e.status]} · ${fill(t.experiments.stage, { n: e.stage, level: t.states[e.level] })}`;
}

function partials(t, view, config) {
  const lang = t.lang;
  const grid = renderGrid(view, {
    lang,
    metric: "still",
    labels: { areas: t.areas, captions: t.hero.areaCaptions, private: t.tip.private },
  });

  const tip = {
    levels: Object.fromEntries(LEVELS.map((l) => [l, `${t.states[l]} · ${t.states[l + "Note"]}`])),
    flags: t.tip.flags,
    outcomes: t.tip.outcomes,
  };

  const stageKeys = ["map", "delegate", "review"];
  const stages = stageKeys
    .map((k, i) => {
      const current = k === view.meta.stage ? ' aria-current="step"' : "";
      const arrow = i < stageKeys.length - 1 ? '<span class="stage-arrow" aria-hidden="true">→</span>' : "";
      return `<button class="stage" type="button" aria-pressed="false" data-show-btn="${k}" data-note="${esc(t.stages[k + "Note"])}"${current}>${esc(t.stages[k])}</button>${arrow}`;
    })
    .join("\n");

  const legend = LEVELS.map(
    (s) =>
      `<li><button class="legend-item" type="button" aria-pressed="false" data-show-btn="${s}">` +
      `<i class="cell legend-swatch" data-s="${s}" aria-hidden="true"></i>` +
      `<span><span class="legend-name">${esc(t.states[s])}</span><span class="legend-desc">${esc(t.states[s + "Note"])}</span></span>` +
      `<span class="legend-count">${view.metrics.counts[s]}</span></button></li>`
  ).join("\n");

  const experiments = sortExperiments(view.experiments)
    .map((e) => {
      const conclusion = e.conclusion ? ` data-conclusion="${e.conclusion.hypothesis}"` : "";
      const bet = pickText(e.hypothesis, lang);
      return (
        `<li class="exp"><span class="exp-id">${esc(e.code)}</span>` +
        `<span class="exp-title">${esc(pickText(e.question, lang))}</span>` +
        `<span class="exp-status" data-status="${e.status}"${conclusion}>${esc(statusText(t, e))}</span>` +
        (bet ? `<p class="exp-bet"><span class="exp-bet-label">${esc(t.experiments.bet)}</span> ${esc(bet)}</p>` : "") +
        `</li>`
      );
    })
    .join("\n");

  const vote = config.voteUrl
    ? `<p class="vote"><a href="${esc(config.voteUrl)}">${esc(t.join.vote)}</a></p>`
    : `<p class="vote-soon">${esc(t.join.voteSoon)}</p>`;

  const sampleTag = (cls = "tag") => `<span class="${cls}" title="${esc(t.hero.sampleNote)}">${esc(t.hero.sample)}</span>`;
  const heroTag = view.sample ? sampleTag() : "";
  const expTag = view.sample ? ` <span class="tag">${esc(t.experiments.sample)}</span>` : "";
  const liveFlag = view.sample ? ` · <span class="live-flag">${esc(t.hero.sample)}</span>` : "";
  const legendTag = view.sample ? ` <span class="tag">${esc(t.hero.sample)}</span>` : "";

  return {
    grid: grid.html,
    gridColumns: grid.columns,
    tip: JSON.stringify(tip),
    stages,
    legend,
    experiments,
    vote,
    heroTag,
    expTag,
    liveFlag,
    legendTag,
  };
}

function render(template, ctx) {
  return template
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, p) => {
      const v = get(ctx, p);
      if (v === undefined) throw new Error(`Missing raw value: ${p}`);
      return String(v);
    })
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => {
      const v = get(ctx, p);
      if (v === undefined) throw new Error(`Missing value: ${p}`);
      return esc(v);
    });
}

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  const [config, en, es, template, view] = await Promise.all([
    readJson(join(src, "config.json")),
    readJson(join(src, "i18n", "en.json")),
    readJson(join(src, "i18n", "es.json")),
    readFile(join(src, "index.html"), "utf8"),
    loadLog(),
  ]);
  const assets = await buildAssets();
  const pct = view.metrics.stillPct;
  const site = config.siteUrl.replace(/\/$/, "");
  for (const t of [en, es]) {
    const other = t.lang === "en" ? es : en;
    // Relative asset URLs, so dist/ works from any base path (Pages root or a local subfolder).
    const base = "../".repeat(t.path.split("/").filter(Boolean).length);
    const preloads = Object.values(assets.fontMap)
      .map((href) => `<link rel="preload" href="${base}${href}" as="font" type="font/woff2" crossorigin>`)
      .join("\n");
    const d = {
      ...partials(t, view, config),
      css: assets.css.replace(/\{\{font:([\w.-]+)\}\}/g, (_, n) => base + assets.fontMap[n]),
      gridJs: base + assets.jsUrl,
      preloads,
      pct,
      ogTitle: fill(t.meta.ogTitle, { pct }),
      base,
      siteUrl: site,
      live: fill(t.header.live, { cycle: view.meta.cycle ?? 0, day: view.meta.day ?? 0 }),
      stageNote: t.stages[(view.meta.stage || "map") + "Note"],
      canonical: site + t.path,
      enUrl: site + en.path,
      esUrl: site + es.path,
      otherPath: other.path === "/" ? base || "./" : base + other.path.slice(1),
      otherLang: other.lang,
    };
    const html = minifyHtml(render(template, { t, c: config, d }));
    const outDir = join(dist, t.path);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "index.html"), html);
  }

  for (const name of await readdir(join(src, "brand"))) {
    if (!name.startsWith(".")) await copyFile(join(src, "brand", name), join(dist, name));
  }
  await copyFile(join(src, "_headers"), join(dist, "_headers"));
  await writeFile(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
  await writeFile(
    join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
      [en, es]
        .map(
          (t) =>
            `<url><loc>${site}${t.path}</loc>` +
            [en, es]
              .map((a) => `<xhtml:link rel="alternate" hreflang="${a.lang}" href="${site}${a.path}"/>`)
              .join("") +
            `</url>`
        )
        .join("\n") +
      `\n</urlset>\n`
  );

  console.log(`built dist/ (${pct}% still him; ${view.sample ? "sample data" : "published log"}; EN + ES)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
