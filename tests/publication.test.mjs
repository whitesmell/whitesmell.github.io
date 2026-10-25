import test from "node:test";
import assert from "node:assert/strict";
import { configuredDelay, eligibleAt, publicationReady } from "../scripts/publication.mjs";
import { validatePost } from "../scripts/audit.mjs";
import { postText } from "../scripts/migration-core.mjs";
test("publication waits seven full days including time and timezone", () => {
  const published = "2026-10-18T18:30:00+08:00";
  const due = Date.parse("2026-10-25T10:30:00Z");
  assert.equal(eligibleAt(published), due);
  assert.equal(publicationReady(published, { now: due - 1 }), false);
  assert.equal(publicationReady(published, { now: due }), true);
  assert.equal(publicationReady(published, { now: due + 1 }), true);
  assert.equal(configuredDelay("title: site\n"), 7);
  assert.equal(configuredDelay("publication_delay_days: 7\n"), 7);
  for (const value of ["-1", "later", "", "1.5"])
    assert.throws(() => configuredDelay("publication_delay_days: " + value));
  assert.throws(() => eligibleAt("invalid"));
});
test("audit prevents a recent free article from leaking through manual file creation", () => {
  const published = "2026-10-18T18:30:00+08:00";
  const text = postText({ title: "来源标题", seo_title: "网页标题", description: "这是一篇保留公众号真实内容的测试文章，未满七天不得上线。", permalink: "/articles/test/", source_id: "test", source_url: "https://mp.weixin.qq.com/s/test", published_at: published, source_hash: "hash", render_with_liquid: false, payment_status: "free" }, "<p>正文</p>");
  assert.throws(() => validatePost(text, { now: eligibleAt(published) - 1 }), /Publication delay/);
  assert.equal(validatePost(text, { now: eligibleAt(published) }).source_id, "test");
});
