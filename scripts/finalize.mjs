import fs from "node:fs/promises";
import path from "node:path";
import { parsePost } from "./audit.mjs";
import { postText, atomicWrite } from "./migration-core.mjs";
const priv = path.resolve(
  process.env.MIGRATION_PRIVATE || "../../migration-private",
);
const state = JSON.parse(
  await fs.readFile(path.join(priv, "state.json"), "utf8"),
);
const overrides = JSON.parse(
  await fs
    .readFile(path.join(priv, "seo-overrides.json"), "utf8")
    .catch(() => "{}"),
);
const entries = [];
for (const file of await fs.readdir("_posts"))
  entries.push({
    file,
    ...parsePost(await fs.readFile(path.join("_posts", file), "utf8")),
  });
for (const entry of entries) {
  for (const key of ["seo_title", "description", "tags"])
    if (overrides[entry.meta.source_id]?.[key])
      entry.meta[key] = overrides[entry.meta.source_id][key];
}
for (const entry of entries)
  entry.meta.description = entry.meta.description.replace(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?发表：/,
    "",
  );
const descriptions = new Map();
for (const entry of entries) {
  const list = descriptions.get(entry.meta.description) || [];
  list.push(entry);
  descriptions.set(entry.meta.description, list);
}
for (const list of descriptions.values())
  if (list.length > 1) {
    for (const entry of list)
      entry.meta.description = `${entry.meta.published_at.slice(0, 19).replace("T", " ")}发表：${entry.meta.description}`;
  }
const groups = new Map();
for (const entry of entries) {
  const title = entry.meta.seo_title;
  const group = groups.get(title) || [];
  group.push(entry);
  groups.set(title, group);
}
for (const group of groups.values())
  if (group.length > 1) {
    for (const entry of group) {
      entry.meta.seo_title += `（${entry.meta.published_at.slice(0, 10)}）`;
      if (
        group.filter(
          (e) =>
            e.meta.published_at.slice(0, 10) ===
            entry.meta.published_at.slice(0, 10),
        ).length > 1
      )
        entry.meta.seo_title += " · " + entry.meta.source_id.slice(0, 4);
    }
  }
const tags = new Set();
const referenced = new Set();
for (const entry of entries) {
  for (const tag of entry.meta.tags) tags.add(tag);
  for (const m of postText(entry.meta, entry.body).matchAll(
    /\/assets\/images\/[a-z0-9.-]+/g,
  ))
    referenced.add(m[0]);
  await atomicWrite(
    path.join("_posts", entry.file),
    postText(entry.meta, entry.body.trimEnd()),
  );
  if (state[entry.meta.source_id])
    for (const key of ["seo_title", "description", "tags"])
      state[entry.meta.source_id][key] = entry.meta[key];
}
for (const name of await fs.readdir("assets/images"))
  if (!referenced.has("/assets/images/" + name))
    await fs.rm(path.join("assets/images", name));
const definitions = {
  AI工具: [
    "tools",
    "AI工具实践与评测",
    "从实际任务出发探索 AI 工具的用法、能力和限制，查找子非AI已发表的工具评测、开源项目介绍与实践教程。",
  ],
  "AI Agent": [
    "agents",
    "AI Agent与智能体应用",
    "了解 AI Agent 如何规划和执行任务，探索个人助手、团队协作、Agent 工程与企业落地案例，理解智能体能力和授权的边界。",
  ],
  RAG: [
    "rag",
    "RAG与知识工程",
    "从检索增强生成到知识库、记忆和知识治理，探索 AI 如何利用企业文档与组织经验，阅读子非AI的 RAG 与知识工程文章。",
  ],
  AI编程: [
    "coding",
    "AI编程与软件工程",
    "阅读 AI 编程工具、编码智能体和软件工程实践，了解代码生成、审核、测试与团队工作方式怎样随着 AI 发生变化。",
  ],
  行业分析: [
    "industry",
    "AI行业分析",
    "跟踪 AI 厂商、开源生态、资本投入和应用商业模式，通过榜单、访谈与具体案例理解技术竞争和行业变化。",
  ],
  AI思考: [
    "thinking",
    "AI与人文思考",
    "讨论 AI 与认知、工作和社会之间的关系，在具体技术和产品变化中思考人的判断、责任，以及智能工具的适用边界。",
  ],
  产品解读: [
    "products",
    "AI产品解读",
    "深入阅读 AI 产品发布与功能变化，从技术选择、使用场景和成本出发，理解产品更新对开发者与使用者意味着什么。",
  ],
  大模型: [
    "models",
    "大模型技术与应用",
    "了解大模型的推理、训练和应用能力，阅读模型发布解读及工程实践，在具体案例中理解性能、成本和使用边界。",
  ],
  开源: [
    "open-source",
    "AI开源项目",
    "探索子非AI介绍的 AI 开源工具、模型与工程项目，了解项目解决的问题、实践方法，以及部署和使用时需要考虑的限制。",
  ],
};
await fs.mkdir("_data", { recursive: true });
const data = {};
for (const tag of tags) {
  const def = definitions[tag];
  if (!def) throw Error("Undefined topic " + tag);
  data[tag] = { slug: def[0], title: def[1], description: def[2] };
  const meta = {
    layout: "topic",
    title: def[1],
    description: def[2],
    topic: tag,
    permalink: `/topics/${def[0]}/`,
  };
  const head = Object.entries(meta)
    .map(([k, v]) => k + ": " + JSON.stringify(v))
    .join("\n");
  await atomicWrite(
    path.join("topics", def[0] + ".html"),
    "---\n" + head + "\n---\n",
  );
}
await atomicWrite("_data/topics.json", JSON.stringify(data, null, 2));
await atomicWrite(
  path.join(priv, "state.json"),
  JSON.stringify(state, null, 2),
);
console.log(
  JSON.stringify({
    articles: entries.length,
    topics: tags.size,
    duplicateTitles: [...groups.values()].filter((g) => g.length > 1).length,
  }),
);
