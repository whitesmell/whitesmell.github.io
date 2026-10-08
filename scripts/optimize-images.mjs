import fs from "node:fs/promises";
import path from "node:path";
import { dependency } from "./runtime.mjs";
import { atomicWrite } from "./migration-core.mjs";
const sharp = dependency("sharp", process.env.SHARP_MODULE),
  root = process.cwd();
const dir = path.join(root, "assets/images"),
  map = new Map();
let before = 0,
  after = 0;
const names = await fs.readdir(dir);
let cursor = 0;
sharp.concurrency(1);
async function worker() {
  while (cursor < names.length) {
    const name = names[cursor++];
    const file = path.join(dir, name);
    const input = await fs.readFile(file);
    before += input.length;
    if (!/\.(png|jpe?g)$/.test(name) || input.includes(Buffer.from("acTL"))) {
      after += input.length;
      continue;
    }
    const metadata = await sharp(input).metadata();
    if (metadata.pages > 1) {
      after += input.length;
      continue;
    }
    const result = await sharp(input)
      .webp(
        name.endsWith(".png")
          ? { lossless: true, effort: 4 }
          : { quality: 92, effort: 4 },
      )
      .toBuffer();
    if (result.length >= input.length * 0.95) {
      after += input.length;
      continue;
    }
    const output = name.replace(/\.[^.]+$/, ".webp");
    await atomicWrite(path.join(dir, output), result);
    map.set("/assets/images/" + name, "/assets/images/" + output);
    after += result.length;
  }
}
await Promise.all([worker(), worker(), worker()]);
for (const file of await fs.readdir("_posts")) {
  const full = path.join("_posts", file);
  let text = await fs.readFile(full, "utf8");
  text = text.replace(
    /\/assets\/images\/[a-z0-9.-]+/g,
    (url) => map.get(url) || url,
  );
  await atomicWrite(full, text);
}
const priv = path.resolve(
  process.env.MIGRATION_PRIVATE || "../../migration-private",
);
for (const name of ["state.json", "assets.json"]) {
  const file = path.join(priv, name);
  let data = await fs.readFile(file, "utf8");
  data = data.replace(
    /\/assets\/images\/[a-z0-9.-]+/g,
    (url) => map.get(url) || url,
  );
  await atomicWrite(file, data);
}
for (const name of map.keys()) await fs.rm(path.join(root, name));
console.log(
  JSON.stringify({
    converted: map.size,
    beforeMB: Math.round(before / 1e6),
    afterMB: Math.round(after / 1e6),
  }),
);
