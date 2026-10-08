import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { classifyPayment } from "./source.mjs";
import { pagePayment } from "./migration-core.mjs";
export function parsePost(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw Error("Missing post frontmatter");
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 1) throw Error("Malformed metadata");
    meta[line.slice(0, i)] = JSON.parse(line.slice(i + 1));
  }
  return { meta, body: m[2] };
}
export function validatePost(text) {
  const { meta, body } = parsePost(text);
  for (const k of [
    "title",
    "seo_title",
    "description",
    "permalink",
    "source_id",
    "source_url",
    "published_at",
    "source_hash",
  ])
    if (!meta[k]) throw Error(`Missing ${k}`);
  if (meta.payment_status !== "free")
    throw Error("Only verified free posts may publish");
  if (meta.render_with_liquid !== false)
    throw Error("Source Liquid evaluation must be disabled");
  if (!/^\/articles\/[a-z0-9-]+\/$/.test(meta.permalink))
    throw Error("Unsafe article URL");
  if (!Number.isFinite(Date.parse(meta.published_at)))
    throw Error("Invalid published date");
  if (meta.modified_at && !Number.isFinite(Date.parse(meta.modified_at)))
    throw Error("Invalid modified date");
  if (meta.description.length < 25 || meta.description.length > 180)
    throw Error("Description needs editing");
  if (new URL(meta.source_url).hostname !== "mp.weixin.qq.com")
    throw Error("Wrong source host");
  if (
    /<(script|iframe|object|embed|form)\b|<[^>]*\son\w+\s*=|<[^>]*(href|src)="javascript:/i.test(
      body,
    )
  )
    throw Error("Unsafe source HTML");
  for (const tag of body.match(/<img\b[^>]*>/g) || []) {
    if (!/src="\/assets\/images\//.test(tag))
      throw Error("Remote source image");
    if (!/width="\d+"/.test(tag) || !/height="\d+"/.test(tag))
      throw Error("Missing image dimensions");
    if (!/alt="[^"]*"/.test(tag)) throw Error("Missing image alt");
  }
  return meta;
}
export async function audit(root, { built = false, privateDir } = {}) {
  const files = (await fs.readdir(path.join(root, "_posts"))).filter((f) =>
    f.endsWith(".html"),
  );
  const metas = [];
  for (const file of files) {
    const meta = validatePost(
      await fs.readFile(path.join(root, "_posts", file), "utf8"),
    );
    metas.push(meta);
  }
  for (const key of ["source_id", "permalink", "seo_title"]) {
    const values = metas.map((m) => m[key]);
    if (new Set(values).size !== values.length) throw Error(`Duplicate ${key}`);
  }
  if (privateDir) {
    const inv = JSON.parse(
      await fs.readFile(path.join(privateDir, "inventory.json"), "utf8"),
    );
    const state = JSON.parse(
      await fs.readFile(path.join(privateDir, "state.json"), "utf8"),
    );
    if (!inv.complete) throw Error("Incomplete private inventory");
    for (const meta of metas) {
      const prev = state[meta.source_id];
      if (!prev) throw Error("Post missing private verification");
      const source = JSON.parse(
        await fs.readFile(
          path.join(privateDir, "articles", meta.source_id + ".json"),
          "utf8",
        ),
      );
      const row = inv.articles.find(
        (r) =>
          String(r.appmsgid) === String(source.mid) &&
          String(r.itemidx) === String(source.idx),
      );
      if (!row || classifyPayment(row, pagePayment(source.flags)) !== "free")
        throw Error("Paid or unknown source in output");
    }
  }
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  if (
    tracked.some((p) =>
      /(^|\/)(migration-private|cookies\.json|inventory\.json|state\.json|raw)(\/|$)/.test(
        p,
      ),
    )
  )
    throw Error("Private data tracked");
  if (built) {
    const site = path.join(root, "_site");
    const topics = JSON.parse(await fs.readFile(path.join(root, "_data/topics.json"), "utf8"));
    const topicIndex = await fs.readFile(path.join(site, "topics/index.html"), "utf8");
    for (const tag of new Set(metas.flatMap((meta) => meta.tags))) {
      const topic = topics[tag];
      if (!topic?.title || !topic.description || !topic.slug)
        throw Error("Undefined topic metadata: " + tag);
      if (!topicIndex.includes(`href="/topics/${topic.slug}/"`) || !topicIndex.includes(topic.title) || !topicIndex.includes(topic.description))
        throw Error("Topic index missing name, description or link: " + tag);
      const topicPage = await fs.readFile(path.join(site, `topics/${topic.slug}/index.html`), "utf8");
      const expected = metas.filter((meta) => meta.tags.includes(tag));
      const links = [...topicPage.matchAll(/href="(\/articles\/[^" ]+\/?)"/g)].map((match) => match[1]);
      if (links.length !== expected.length || expected.some((meta) => !links.includes(meta.permalink)))
        throw Error("Topic article membership mismatch: " + tag);
    }
    for (const p of ["scripts", "tests", "migration-private", ".git"])
      if (
        await fs
          .stat(path.join(site, p))
          .then(() => true)
          .catch(() => false)
      )
        throw Error("Private/tool path in build");
    const search = JSON.parse(
      await fs.readFile(path.join(site, "search.json"), "utf8"),
    );
    if (search.length !== metas.length) throw Error("Search count mismatch");
    const map = new Map(metas.map((m) => [m.permalink, m]));
    for (const a of search)
      if (!map.has(a.url)) throw Error("Unexpected search entry");
    const sitemap = await fs.readFile(path.join(site, "sitemap.xml"), "utf8");
    const rss = await fs.readFile(path.join(site, "feed.xml"), "utf8");
    for (const meta of metas) {
      const html = await fs.readFile(
        path.join(site, meta.permalink, "index.html"),
        "utf8",
      );
      if ((html.match(/<h1\b/g) || []).length !== 1)
        throw Error("Article requires one H1");
      if (
        !html.includes(
          `<link rel="canonical" href="https://whitesmell.github.io${meta.permalink}">`,
        )
      )
        throw Error("Canonical mismatch");
      const blocks = html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      );
      let found = false;
      for (const b of blocks) {
        const d = JSON.parse(b[1]);
        if (d["@type"] === "BlogPosting") {
          found = true;
          if (
            d.datePublished !== meta.published_at ||
            d.url !== "https://whitesmell.github.io" + meta.permalink
          )
            throw Error("Structured data mismatch");
        }
      }
      if (
        !found ||
        !sitemap.includes("https://whitesmell.github.io" + meta.permalink)
      )
        throw Error("Article missing indexing metadata");
      for (const img of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
        if (img[1].startsWith("/assets/"))
          await fs.access(path.join(site, img[1]));
      }
    }
    if (
      !/noindex,follow/.test(
        await fs.readFile(path.join(site, "search/index.html"), "utf8"),
      )
    )
      throw Error("Search page must noindex");
    const links = [
      ...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g),
      ...rss.matchAll(/<link>([^<]+)<\/link>/g),
    ];
    for (const l of links) {
      const u = new URL(l[1]);
      if (u.origin !== "https://whitesmell.github.io")
        throw Error("Wrong indexing origin");
      if (u.pathname.startsWith("/articles/") && !map.has(u.pathname))
        throw Error("Unexpected indexing entry");
    }
  }
  return { posts: metas.length, built, sourceVerified: !!privateDir };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await audit(process.cwd(), {
    built: process.argv.includes("--built"),
    privateDir: process.argv.includes("--private")
      ? path.resolve(process.env.MIGRATION_PRIVATE || "../../migration-private")
      : undefined,
  });
  console.log(JSON.stringify(result));
}
