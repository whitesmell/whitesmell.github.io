import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { flag, identity } from "./source.mjs";
import { classifyTopics } from "./topics.mjs";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function pagePayment(flags) {
  const values = ["is_pay_subscribe", "need_pay", "isPayTopic"].map((k) =>
    Object.hasOwn(flags, k) ? flag(flags[k]) : "unknown",
  );
  if (values.includes("paid")) return "paid";
  return values.every((v) => v === "free") ? "free" : "unknown";
}
export function metadata(row, source, previous = {}) {
  const id = identity(row),
    title = source.title?.trim();
  if (!title) throw Error("Missing source title");
  const ts = Number(source.timestamp || row.publish_timestamp);
  if (!Number.isFinite(ts) || ts <= 0) throw Error("Missing publication date");
  const published = new Date(ts * 1000 + 8 * 3600000)
    .toISOString()
    .replace("Z", "+08:00");
  const date = published.slice(0, 10);
  const tags = classifyTopics(title, source.digest || source.text.slice(0, 300));
  const clean = (s) => s.replace(/\s+/g, " ").trim();
  const paragraphs =
    source.paragraphs
      ?.map(clean)
      .filter(
        (p) =>
          p.length > 35 && !/扫码|关注公众号|点击.*阅读原文|赞赏|广告/.test(p),
      ) || [];
  const desc = clean(source.digest || paragraphs[0] || source.text).slice(
    0,
    110,
  );
  if (desc.length < 25) throw Error("Description needs review");
  const fragment =
    title.match(/[A-Za-z][A-Za-z0-9.-]*(?:\s+[A-Za-z0-9.-]+){0,2}/)?.[0] ||
    tags[0];
  const slug =
    fragment
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "ai";
  return {
    source_id: id,
    title,
    seo_title: title,
    description: desc,
    tags,
    author: source.author || "子非AI",
    author_type: source.author ? "Person" : "Organization",
    published_at: published,
    date: published,
    permalink: previous.permalink || `/articles/${date}-${slug}-${id}/`,
    source_url: row.link,
    render_with_liquid: false,
    payment_status: "free",
    source_hash: hash(source.html || source.text),
  };
}
export function postText(meta, html) {
  const keys = Object.entries({ layout: "post", ...meta })
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${keys}\n---\n${html}\n`;
}
export async function applyRemoval(root, previous, state) {
  if (state !== "paid" && state !== "removed") return false;
  if (!previous.file) return false;
  const f = path.resolve(root, previous.file);
  if (!f.startsWith(path.resolve(root) + path.sep))
    throw Error("Unsafe output path");
  await fs.rm(f, { force: true });
  return true;
}

export async function atomicWrite(file, data) {
  const temp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.tmp`,
  );
  try {
    await fs.writeFile(temp, data);
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true });
  }
}
