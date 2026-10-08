import test from "node:test";
import assert from "node:assert/strict";
import { validatePost } from "../scripts/audit.mjs";
import { postText } from "../scripts/migration-core.mjs";
const m = {
  title: "测试标题",
  seo_title: "测试标题",
  description:
    "描述文章实际回答的问题，保留来源事实，并为读者提供足够清楚的主题信息。",
  permalink: "/articles/2024-01-01-test-123/",
  source_id: "123",
  source_url: "https://mp.weixin.qq.com/s/test",
  published_at: "2024-01-01T01:00:00+08:00",
  source_hash: "abc",
  render_with_liquid: false,
  payment_status: "free",
};
test("audit rejects paid/unknown source and active HTML", () => {
  assert.equal(validatePost(postText(m, "<p>文章正文</p>")).source_id, "123");
  for (const status of ["paid", "unknown"])
    assert.throws(() =>
      validatePost(postText({ ...m, payment_status: status }, "正文")),
    );
  for (const body of [
    "<script>alert(1)</script>",
    '<img src="https://example.com/a.png">',
    '<p onclick="x()">正文</p>',
  ])
    assert.throws(() => validatePost(postText(m, body)));
});
test("audit rejects missing or fabricated timestamp metadata", () => {
  assert.throws(() =>
    validatePost(postText({ ...m, modified_at: "undefined" }, "正文")),
  );
  assert.throws(() =>
    validatePost(postText({ ...m, description: "" }, "正文")),
  );
});
