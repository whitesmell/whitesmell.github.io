import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { postText } from "../scripts/migration-core.mjs";
import { parsePost } from "../scripts/audit.mjs";
test("finalization distinguishes duplicate titles, builds populated topics and prunes orphan assets", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "zifeiai-finalize-"));
  const root = path.join(tmp, "site"),
    priv = path.join(tmp, "private");
  await fs.mkdir(path.join(root, "_posts"), { recursive: true });
  await fs.mkdir(path.join(root, "assets/images"), { recursive: true });
  await fs.mkdir(path.join(root, "topics"));
  await fs.mkdir(priv);
  const state = {};
  for (const id of ["a", "b"]) {
    const meta = {
      title: "同名原始文章",
      seo_title: "同名原始文章",
      description: "源自正文的真实摘要，不通过改变原始标题制造区别。",
      tags: ["RAG"],
      published_at: "2024-01-01T12:00:00+08:00",
      source_id: id,
    };
    state[id] = meta;
    await fs.writeFile(
      path.join(root, "_posts", id + ".html"),
      postText(meta, "<p>保持正文</p>"),
    );
  }
  await fs.writeFile(path.join(priv, "state.json"), JSON.stringify(state));
  await fs.writeFile(path.join(root, "assets/images/orphan.png"), "DISPOSABLE");
  try {
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/finalize.mjs", import.meta.url))],
      { cwd: root, env: { ...process.env, MIGRATION_PRIVATE: priv } },
    );
    const a = parsePost(
        await fs.readFile(path.join(root, "_posts/a.html"), "utf8"),
      ),
      b = parsePost(
        await fs.readFile(path.join(root, "_posts/b.html"), "utf8"),
      );
    assert.equal(a.meta.title, "同名原始文章");
    assert.notEqual(a.meta.seo_title, b.meta.seo_title);
    assert.equal(a.body, "<p>保持正文</p>\n");
    await fs.access(path.join(root, "topics/rag.html"));
    await assert.rejects(
      fs.access(path.join(root, "assets/images/orphan.png")),
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
