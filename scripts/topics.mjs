// Use explicit subject terms; generic words such as “future” do not prove a topic.
const rules = [
  ["AI编程", /编程|代码|coding|Claude Code|Codex|Cursor|程序员|软件工程|软件工厂|Replit|Copilot|\bIDE\b/i],
  ["RAG", /\bRAG\b|检索增强|知识库|知识工程|知识治理|Text.to.SQL|\bSQL\b|MindsDB|向量数据库|Embedding|OpenWiki|第二大脑/i],
  ["AI Agent", /\bagents?\b|智能体|Manus|助手|助理|\bMCP\b|\bA2A\b|\bSkills\b/i],
  ["AI工具", /工具|评测|测评|实测|实践|教程|指南|上手|用法|体验|提示词|提示工程|工作流|\bprompt\b|\bMCP\b|\bSkills\b/i],
  ["行业分析", /行业|融资|估值|收购|百强|a16z|榜单|财报|资本|裁员|市值|重组|商业模式|市场竞争|战略|行业报告/i],
  ["AI思考", /哲学|人文|社会|认知|意识|就业|失业|伦理|乌托邦|技术乐观|人工智能风险|AI思考|AI 思考|人类/i],
  ["大模型", /大模型|\bLLM\b|模型|DeepSeek|\bGPT\b|ChatGPT|\bClaude\b|Gemini|Llama|Qwen|Ollama|\bo[134]\b|\bKimi\b|Bard|混元|\bSora\b/i],
  ["开源", /开源|open.source|Llama|Ollama|MindsDB/i],
  ["产品解读", /发布|新品|产品|更新|升级|DevDay/i],
];
export function classifyTopics(title, description = "") {
  const match = (text) => rules.filter(([, re]) => re.test(text)).map(([tag]) => tag);
  const primary = match(title);
  return primary.length ? primary : match(description).length ? match(description) : ["产品解读"];
}
