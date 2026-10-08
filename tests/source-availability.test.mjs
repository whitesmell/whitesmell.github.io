import test from "node:test";
import assert from "node:assert/strict";
import { sourceAvailability } from "../scripts/source.mjs";
test("only explicit platform removal without an article proves withdrawal", () => {
  assert.equal(sourceAvailability("该内容已被发布者删除", false), "removed");
  assert.equal(sourceAvailability("此内容因违规无法查看", false), "removed");
  assert.equal(sourceAvailability("此内容因违规无法查看", true), "available");
  assert.equal(sourceAvailability("环境异常，请完成验证", false), "unknown");
});
