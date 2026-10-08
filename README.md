# 子非AI

子非AI，焉知AI之乐。

本站用 Jekyll 和 GitHub Pages 归档公众号已发表的免费文章。正文、标题、图片和发表时间取自微信原文；网页 SEO 信息单独维护。

## 本地预览

安装 Ruby 4.0、Bundler 和 Node.js 20 或更新版本，然后运行：

```sh
bundle install
bundle exec jekyll serve
```

访问终端显示的本地地址。Node.js 用于测试、迁移和审计，站点正文不依赖 JavaScript。

## 同步公众号

迁移工具默认将原始清单、页面证据和登录会话保存在本仓库外的 `../../migration-private`。使用独立站点 checkout；不要把该私有目录移动到公开仓库。可通过 `MIGRATION_PRIVATE` 指定其他仓库外目录。

安装本地采集依赖：

```sh
npm install --no-save playwright sharp image-size
npm run collect -- --login
npm run migrate
node scripts/finalize.mjs
node scripts/optimize-images.mjs
bundle exec jekyll build
npm run audit -- --built --private
```

工具默认使用 macOS Chrome 和 `http://127.0.0.1:7890` 代理。通过 `CHROME_BIN`、`MIGRATION_PROXY` 调整；在 Codex 桌面中也可使用已经提供的依赖运行时。

`collect` 获取完整发表清单；`migrate` 重新核验原文，按稳定文章身份与内容 hash 更新。不要将采集放进 GitHub Actions，也不要上传微信会话。中断后可在同一份来源清单上使用 `npm run migrate -- --resume` 复用已核验缓存；清单超过24小时必须刷新。

付费状态缺失或冲突时不放行。明确转付费或撤回的内容会移除当前文章，重新生成站点时同步清除搜索、RSS 和 sitemap。原文已失效的记录只进入私有对账，不改用本地草稿。

视频和音频在原位置保留微信原文播放入口，正文和配图完整保留。贴图等非文章类型不纳入文章归档。

## 每篇文章的 SEO

文章保留原始 H1、发布时间和微信链接。网页 title、description、canonical、Open Graph、BlogPosting 与面包屑由模板输出。图片保留尺寸，非首屏延迟加载；相关文章与主题页提供 HTML 入口。

可在私有目录的 `seo-overrides.json` 中，按 `source_id` 设置 `seo_title`、`description` 和 `tags`。`finalize` 会应用这些字段，并为同名标题与重复摘要添加真实发表时间以区分。正文和原始标题不接受覆盖。

`datePublished` 使用原始发表时间。只在确有来源内容变化时记录 `dateModified`。标题修改不改变 permalink。canonical 指向本站，微信链接表达出处；搜索引擎仍可自行选择规范版本。

## 检查与发布

```sh
npm test
node scripts/check-render.mjs
bundle exec jekyll build
npm run audit -- --built --private
```

`check-render` 验证公众号正文中的 Liquid 示例不会被执行。`audit --private` 用仓库外的来源证据再检查收费状态；CI 运行 `audit --built` 检查公开文件、文章元数据、结构化数据、图片、RSS、搜索与 sitemap。

GitHub Pages 发布源设为 GitHub Actions。主分支更新后，工作流执行测试、构建和审计，仅上传 `_site`。Pull Request 只构建检查，不部署。发布前检查整个提交清单，不提交私有采集目录或登录凭据。

已经公开后转付费的内容可能仍存在于 Git 历史与第三方缓存。删除当前文件不能回收这些副本；需要另行处理历史与缓存，不能宣称已经完全撤回。

## 搜索收录

在 Google Search Console 中验证 `https://whitesmell.github.io/` 的 URL-prefix 属性，取得验证标签或 HTML 文件后加入站点，再提交 `https://whitesmell.github.io/sitemap.xml`。

上线后第7、30、60天检查页面抓取、规范版本选择、收录、展示和点击。优先排查未收录、重复标题、失效图片与链接；不靠修改历史发布日期制造新内容，也不保证收录或排名。
