import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  pagePayment,
  metadata,
  applyRemoval,
  postText,
} from "../scripts/migration-core.mjs";
test("page payment needs explicit flags; pay topic and preview are excluded", () => {
  assert.equal(
    pagePayment({ is_pay_subscribe: 0, need_pay: 0, isPayTopic: 0 }),
    "free",
  );
  assert.equal(
    pagePayment({ is_pay_subscribe: 0, need_pay: 1, isPayTopic: 0 }),
    "paid",
  );
  assert.equal(pagePayment({ is_pay_subscribe: 0, need_pay: 0 }), "unknown");
});
test("metadata keeps date and body and freezes URL across title changes", () => {
  const row = {
    title: "Claude 编程实践",
    publish_timestamp: 1720000000,
    link: "https://mp.weixin.qq.com/s/test",
    appmsgid: 3,
    itemidx: 1,
  };
  const source = {
    title: row.title,
    author: "子非AI",
    text: "这是一篇关于 Claude 编程的实践文章。".repeat(10),
    paragraphs: ["这是一篇关于 Claude 编程的实践文章。".repeat(5)],
  };
  const a = metadata(row, source);
  const b = metadata(
    { ...row, title: "新题" },
    { ...source, title: "新题" },
    a,
  );
  assert.equal(a.permalink, b.permalink);
  assert.ok(a.description.length >= 30);
  assert.match(a.published_at, /\+08:00$/);
  assert.ok(postText(a, "<p>正文</p>").endsWith("<p>正文</p>\n"));
  assert.match(postText(a, "x"), /render_with_liquid: false/);
});
test("explicit removal deletes output while source timeout does not", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "zifeiai-test-"));
  await writeFile(path.join(root, "post.html"), "PUBLIC");
  assert.equal(
    await applyRemoval(root, { file: "post.html" }, "unknown"),
    false,
  );
  assert.equal(await readFile(path.join(root, "post.html"), "utf8"), "PUBLIC");
  assert.equal(await applyRemoval(root, { file: "post.html" }, "paid"), true);
});

test("corrected source publication time updates display while retaining URL", () => {
  const row = {
    title: "来源标题",
    publish_timestamp: 1720000000,
    link: "https://mp.weixin.qq.com/s/test",
    appmsgid: 11,
    itemidx: 1,
  };
  const source = {
    title: row.title,
    text: "原文正文完整内容。".repeat(30),
    paragraphs: ["原文正文完整内容。".repeat(30)],
  };
  const a = metadata(row, source);
  const b = metadata({ ...row, publish_timestamp: 1720086400 }, source, a);
  assert.equal(a.permalink, b.permalink);
  assert.notEqual(a.published_at, b.published_at);
});
