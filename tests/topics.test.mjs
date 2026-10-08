import test from "node:test";
import assert from "node:assert/strict";
import { classifyTopics } from "../scripts/topics.mjs";
test("topics recognize model and open-source articles without generic future or body mentions", () => {
  assert.ok(classifyTopics("Claude Opus 4.5发布").includes("大模型"));
  assert.ok(classifyTopics("开源 Llama 模型实践").includes("开源"));
  assert.ok(classifyTopics("Text-to-SQL：MindsDB教程").includes("RAG"));
  assert.ok(!classifyTopics("AI智能体发展现状与未来趋势").includes("AI思考"));
  assert.ok(!classifyTopics("a16z AI百强榜", "未来和代码会怎样？").includes("AI编程"));
});
