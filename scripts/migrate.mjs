import fs from "node:fs/promises";
import path from "node:path";
import { dependency, chromeBinary } from "./runtime.mjs";
import {
  flag,
  identity,
  classifyPayment,
  sourceAvailability,
} from "./source.mjs";
import {
  hash,
  pagePayment,
  metadata,
  postText,
  applyRemoval,
  atomicWrite,
} from "./migration-core.mjs";
const { chromium } = dependency("playwright", process.env.PLAYWRIGHT_MODULE);
const { imageSize } = dependency("image-size", process.env.IMAGE_SIZE_MODULE);
const sharp = dependency("sharp", process.env.SHARP_MODULE);
const root = process.cwd(),
  priv = path.resolve(
    process.env.MIGRATION_PRIVATE || "../../migration-private",
  );
if (priv === root || priv.startsWith(root + path.sep))
  throw Error("Private data cannot live in site checkout");
const inventory = JSON.parse(
  await fs.readFile(path.join(priv, "inventory.json"), "utf8"),
);
if (!inventory.complete) throw Error("Source inventory is incomplete");
if (Date.now() - Date.parse(inventory.fetched_at) > 24 * 3600000)
  throw Error("Refresh inventory before publishing");
await fs.mkdir(path.join(priv, "articles"), { recursive: true });
await fs.mkdir("_posts", { recursive: true });
await fs.mkdir("assets/images", { recursive: true });
const state = JSON.parse(
  await fs.readFile(path.join(priv, "state.json"), "utf8").catch(() => "{}"),
);
const overrides = JSON.parse(
  await fs
    .readFile(path.join(priv, "seo-overrides.json"), "utf8")
    .catch(() => "{}"),
);
const limit = Number(process.env.MIGRATION_LIMIT || 0);
const selectedIds = process.env.MIGRATION_IDS?.split(",");
const rows = selectedIds
  ? inventory.articles.filter((row) => selectedIds.includes(identity(row)))
  : limit
    ? inventory.articles.slice(0, limit)
    : inventory.articles;
const report = {
  started_at: new Date().toISOString(),
  source_count: inventory.articles.length,
  selected_count: rows.length,
  published: [],
  paid: [],
  unknown: [],
  failed: [],
  removed: [],
  not_applicable: [],
};
const browser = await chromium.launch({
  headless: true,
  executablePath: chromeBinary(),
  proxy: { server: process.env.MIGRATION_PROXY || "http://127.0.0.1:7890" },
});
const ctx = await browser.newContext();
try {
  await ctx.addCookies(
    JSON.parse(await fs.readFile(path.join(priv, "cookies.json"), "utf8")),
  );
} catch {}
let cursor = 0;
const knownAssets = new Map();
const assetCache = JSON.parse(
  await fs.readFile(path.join(priv, "assets.json"), "utf8").catch(() => "{}"),
);
let writes = Promise.resolve();
function persist() {
  writes = writes.then(async () => {
    for (const [name, value] of [
      ["state.json", state],
      ["report.json", report],
      ["assets.json", assetCache],
    ]) {
      const temp = path.join(priv, name + ".tmp");
      await fs.writeFile(temp, JSON.stringify(value, null, 2));
      await fs.rename(temp, path.join(priv, name));
    }
  });
  return writes;
}
async function asset(url) {
  const cached = assetCache[url];
  if (
    cached &&
    (await fs
      .stat(path.join(root, cached.local))
      .then(() => true)
      .catch(() => false))
  )
    return cached;
  if (knownAssets.has(url)) return knownAssets.get(url);
  const promise = downloadAsset(url);
  knownAssets.set(url, promise);
  return promise;
}
async function downloadAsset(url) {
  const u = new URL(url);
  if (
    !["https:", "http:"].includes(u.protocol) ||
    !/(^|\.)(qpic\.cn|qlogo\.cn|weixin\.qq\.com|qq\.com)$/.test(u.hostname)
  )
    throw Error("Unsupported image host");
  const res = await ctx.request.get(url, { timeout: 30000 });
  if (!res.ok()) throw Error(`Image HTTP ${res.status()}`);
  let data = await res.body();
  if (data.length < 20) throw Error("Empty image");
  let size = imageSize(data);
  let ext = size.type;
  if (ext === "svg") {
    data = await sharp(data, { density: 144 }).png().toBuffer();
    size = imageSize(data);
    ext = "png";
  }
  if (!["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
    throw Error("Image response is not supported raster");
  const name = `${hash(data).slice(0, 24)}.${ext === "jpeg" ? "jpg" : ext}`;
  await atomicWrite(path.join(root, "assets/images", name), data);
  assetCache[url] = {
    local: "/assets/images/" + name,
    width: size.width,
    height: size.height,
  };
  return assetCache[url];
}
async function run() {
  const page = await ctx.newPage();
  while (cursor < rows.length) {
    const row = rows[cursor++];
    let id;
    let inspectedCurrentSource = false;
    try {
      id = identity(row);
      const prev = state[id] || {};
      if (flag(row.is_pay_subscribe) === "paid") {
        await applyRemoval(root, prev, "paid");
        delete state[id];
        report.paid.push(id);
        continue;
      }
      if (row.item_show_type !== 0) {
        report.not_applicable.push({
          id,
          type: row.item_show_type,
          title: row.title,
        });
        continue;
      }
      if (flag(row.is_pay_subscribe) === "unknown") {
        report.unknown.push(id);
        continue;
      }
      const cachePath = path.join(priv, "articles", id + ".json");
      let source;
      const cached = JSON.parse(
        await fs.readFile(cachePath, "utf8").catch(() => "null"),
      );
      if (
        process.argv.includes("--resume") &&
        cached?.inventory_at === inventory.fetched_at &&
        cached.title &&
        !cached.images?.some((image) => !image) &&
        pagePayment(cached.flags) !== "unknown" &&
        (!cached.media?.length || cached.media_preserved)
      )
        source = cached;
      else {
        await page.goto(row.link, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        inspectedCurrentSource = true;
        await page.waitForSelector("#js_content", {
          state: "attached",
          timeout: 12000,
        });
        source = await page.evaluate((sourceUrl) => {
          const content = document.querySelector("#js_content");
          const text = content?.textContent?.trim() || "";
          const flags = {};
          for (const k of ["is_pay_subscribe", "need_pay", "isPayTopic"])
            if (typeof window[k] !== "undefined") flags[k] = window[k];
          const copy = content.cloneNode(true);
          for (const avatar of copy.querySelectorAll(
            "#js_tail_panel_account_avatar",
          ))
            avatar.closest(".profile_info_wrp")?.remove();
          const media = [
            ...copy.querySelectorAll(
              "video,audio,iframe,mp-common-videosnap,mpvoice,qqmusic",
            ),
          ].map((n) => n.tagName);
          const mediaSelector =
            "video,audio,iframe,mp-common-videosnap,mpvoice,qqmusic";
          let mediaNumber = 0;
          for (const el of [...copy.querySelectorAll(mediaSelector)]) {
            if (el.parentElement?.closest(mediaSelector)) continue;
            mediaNumber++;
            const fallback = document.createElement("p");
            const link = document.createElement("a");
            link.href = sourceUrl;
            link.textContent = `在微信原文播放视频或音频（第 ${mediaNumber} 段）`;
            fallback.append(link);
            el.replaceWith(fallback);
          }
          const allowed = new Set([
            "SECTION",
            "DIV",
            "P",
            "SPAN",
            "BR",
            "STRONG",
            "B",
            "EM",
            "I",
            "U",
            "S",
            "H1",
            "H2",
            "H3",
            "H4",
            "H5",
            "H6",
            "UL",
            "OL",
            "LI",
            "BLOCKQUOTE",
            "PRE",
            "CODE",
            "TABLE",
            "THEAD",
            "TBODY",
            "TR",
            "TD",
            "TH",
            "A",
            "IMG",
            "HR",
            "SUP",
            "SUB",
          ]);
          for (const el of [...copy.querySelectorAll("*")].reverse()) {
            if (
              [
                "SCRIPT",
                "STYLE",
                "NOSCRIPT",
                "FORM",
                "INPUT",
                "BUTTON",
                "IFRAME",
                "OBJECT",
                "EMBED",
              ].includes(el.tagName)
            ) {
              el.remove();
              continue;
            }
            if (!allowed.has(el.tagName)) {
              el.replaceWith(...el.childNodes);
              continue;
            }
            const imgSrc =
              el.tagName === "IMG"
                ? el.getAttribute("data-src") || el.getAttribute("src")
                : null;
            const href = el.tagName === "A" ? el.getAttribute("href") : null;
            const alt = el.getAttribute("alt") || "";
            const style = el.getAttribute("style") || "";
            for (const a of [...el.attributes]) el.removeAttribute(a.name);
            const safeStyles = style
              .split(";")
              .map((s) => s.trim())
              .filter(
                (s) =>
                  /^(color|background-color|font-weight|font-style|text-align|text-decoration|line-height|font-size|letter-spacing|border-left|padding-left):/i.test(
                    s,
                  ) && !/[{}<>]|url\(|expression|\\/i.test(s),
              );
            if (safeStyles.length)
              el.setAttribute("style", safeStyles.join(";"));
            if (el.tagName === "H1")
              el.outerHTML = "<h2>" + el.innerHTML + "</h2>";
            if (imgSrc) {
              el.setAttribute("src", imgSrc);
              el.setAttribute("alt", alt);
              el.setAttribute("loading", "lazy");
            }
            if (href) {
              try {
                const u = new URL(href, location.href);
                if (["https:", "http:"].includes(u.protocol)) {
                  el.setAttribute("href", u.href);
                  el.setAttribute("rel", "noopener noreferrer");
                }
              } catch {}
            }
          }
          return {
            title: document.querySelector("#activity-name")?.textContent.trim(),
            author: document
              .querySelector("#js_author_name")
              ?.textContent.trim(),
            account: document.querySelector("#js_name")?.textContent.trim(),
            biz: window.biz,
            mid: window.mid,
            idx: window.idx,
            timestamp: window.ct,
            digest: window.msg_desc || "",
            flags,
            text,
            html: copy.innerHTML,
            paragraphs: [...content.querySelectorAll("p")].map((p) =>
              p.textContent.trim(),
            ),
            images: [...copy.querySelectorAll("img")].map((i) =>
              i.getAttribute("src"),
            ),
            media,
            media_preserved: true,
          };
        }, row.link);
        source.fetched_at = new Date().toISOString();
        source.inventory_at = inventory.fetched_at;
        await fs.writeFile(cachePath, JSON.stringify(source));
      }
      if (source.account !== "子非AI" || source.biz !== "Mzg2MjkwNzY4OA==")
        throw Error("Source account mismatch");
      if (
        String(source.mid) !== String(row.appmsgid) ||
        String(source.idx) !== String(row.itemidx)
      )
        throw Error("Source article identity mismatch");
      const payment = classifyPayment(row, pagePayment(source.flags));
      if (payment !== "free") {
        report.unknown.push(id);
        if (pagePayment(source.flags) === "paid") {
          await applyRemoval(root, prev, "paid");
          delete state[id];
          report.removed.push(id);
        }
        continue;
      }
      if (source.text.length < 50) throw Error("Incomplete body");
      if (source.media.length && !source.media_preserved)
        throw Error("Embedded media requires manual preservation review");
      let html = source.html;
      const mapping = [];
      for (const image of new Set(source.images)) {
        if (!image) throw Error("Image URL missing");
        const resource = await asset(image);
        mapping.push({ source: image, ...resource });
        html = html
          .split(image.replaceAll("&", "&amp;"))
          .join(resource.local)
          .split(image)
          .join(resource.local);
      }
      let imageNumber = 0;
      html = html.replace(/<img\b[^>]*>/g, (tag) => {
        imageNumber++;
        const resource = mapping.find((a) => tag.includes(a.local));
        if (!resource) throw Error("Unmapped image");
        return tag
          .replace('alt=""', `alt="正文配图 ${imageNumber}"`)
          .replace(
            />$/,
            ` width="${resource.width}" height="${resource.height}">`,
          );
      });
      const meta = metadata(row, source, prev);
      if (overrides[id]) {
        for (const k of ["seo_title", "description", "tags"])
          if (overrides[id][k]) meta[k] = overrides[id][k];
      }
      if (source.media.length)
        meta.media_note = `本篇包含 ${source.media.length} 处视频或音频，正文与配图保留，媒体请通过文中链接在微信原文播放。`;
      const cover = row.cover || row.cover_img || source.images[0];
      if (cover) meta.cover = (await asset(cover)).local;
      meta.modified_at =
        prev.source_hash &&
        (prev.source_hash !== meta.source_hash ||
          prev.title !== meta.title ||
          prev.author !== meta.author ||
          prev.published_at !== meta.published_at)
          ? source.fetched_at
          : prev.modified_at;
      const file =
        prev.file || `_posts/${meta.published_at.slice(0, 10)}-${id}.html`;
      await atomicWrite(file, postText(meta, html));
      state[id] = {
        ...meta,
        file,
        images: mapping,
        verified_at: source.fetched_at,
      };
      report.published.push(id);
      console.log(
        `迁移 ${report.published.length} / 处理 ${cursor}/${rows.length}: ${source.title}`,
      );
    } catch (e) {
      if (id && inspectedCurrentSource) {
        const hasArticle =
          (await page
            .locator("#activity-name")
            .count()
            .catch(() => 0)) > 0;
        const visibleText = await page
          .locator("body")
          .innerText()
          .catch(() => "");
        if (sourceAvailability(visibleText, hasArticle) === "removed") {
          await applyRemoval(root, state[id] || {}, "removed");
          delete state[id];
          report.removed.push(id);
          e.message = "Source removed by author or platform";
        }
      }
      report.failed.push({
        id: id || null,
        title: row.title,
        reason: e.message
          .replace(/https?:\/\/\S+/g, "[source URL]")
          .split("\n")[0],
      });
      console.log(
        `待处理 ${cursor}/${rows.length}: ${report.failed.at(-1).reason}`,
      );
    }
    await persist();
    await page.waitForTimeout(700);
  }
  await page.close();
}
try {
  await Promise.all([run(), run(), run()]);
  if (!limit && !selectedIds) {
    const currentIds = new Set(inventory.articles.map(identity));
    const inspector = await ctx.newPage();
    for (const [id, previous] of Object.entries(state)) {
      if (currentIds.has(id)) continue;
      try {
        await inspector.goto(previous.source_url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        const hasArticle =
          (await inspector.locator("#activity-name").count()) > 0;
        const text = await inspector.locator("body").innerText();
        const fields = await inspector.evaluate(() =>
          Object.fromEntries(
            ["is_pay_subscribe", "need_pay", "isPayTopic"]
              .filter((k) => typeof window[k] !== "undefined")
              .map((k) => [k, window[k]]),
          ),
        );
        if (
          sourceAvailability(text, hasArticle) === "removed" ||
          pagePayment(fields) === "paid"
        ) {
          await applyRemoval(root, previous, "removed");
          delete state[id];
          report.removed.push(id);
        } else
          report.failed.push({
            id,
            title: previous.title,
            reason:
              "Missing from complete publication inventory; source status unresolved",
          });
      } catch {
        report.failed.push({
          id,
          title: previous.title,
          reason: "Missing publication source temporarily unavailable",
        });
      }
    }
    await inspector.close();
  }
} finally {
  await browser.close();
}
report.finished_at = new Date().toISOString();
await persist();
console.log(
  JSON.stringify({
    published: report.published.length,
    paid: report.paid.length,
    unknown: report.unknown.length,
    failed: report.failed.length,
    not_applicable: report.not_applicable.length,
  }),
);
