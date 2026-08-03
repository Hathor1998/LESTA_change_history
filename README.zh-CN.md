# WoWS 平衡改动档案

## 用途

生产站点是只读的 GitHub Pages 改动浏览器。本地开发模式额外提供数据导入和数据管理工具，不会在生产网页中暴露写入入口。

## 官方公告数据库

`data/database/korabli-official.json` 是可提交到 Git 的官方公告数据包，收录自 `blog.korabli.su` 的最近两年平衡改动公告。每条记录保存：

- 官方公告 URL、标题和发布时间
- 原始俄文改动句
- 前后数值、属性、舰船上下文和分类
- 自动分析结果：`buff`、`nerf`、`neutral` 或 `adjustment`
- 判定规则和置信度

趋势自动判定优先比较前后数值，再按属性方向判定。例如装填、隐蔽和散布数值降低视为增强；伤害、射程、速度等数值提高视为增强。无法可靠判断强弱的文本会归为 `adjustment`，不会伪装成增强或削弱。

同步后脚本会生成 `data/raw/ship.tsv`、`data/raw/mechanic.tsv`、`data/raw/misc.tsv` 镜像，因此网页和本地数据管理仍使用统一数据结构。

## 本地更新流程

```bash
npm install
npm run data:sync:official
npm run data:translate:zh
npm run data:validate
npm run lint
npm run build
npm run data:bundle
```

`npm run data:sync:official` 默认抓取最近 730 天。可通过环境变量调整范围，例如 `KORABLI_DAYS=365 npm run data:sync:official`。同步需要访问官方站点；脚本有分页边界、并发限制和三次重试，避免无控制地抓取。

`npm run data:translate:zh` 会优先读取本机 `global.mo` 的舰船中文名，再通过本机 Claude 配置中的 DeepSeek 兼容网关翻译其余展示字段。凭据只在本机读取，绝不写入仓库；GitHub Actions 只使用已提交的翻译数据包。

如果需要继续使用整理好的 Excel 舰船日志，可运行 `npm run data:import:excel`。官方同步会以公告数据库重新生成三类 TSV，因此两种来源请在一次发布中择一作为主来源。

## GitHub Pages 与自动更新

1. 在 GitHub `Settings > Pages` 中选择从 `main` 分支的 `/docs` 发布。
2. 推送数据包后，`.github/workflows/refresh-data.yml` 会自动构建并提交新的 `docs/`。
3. 该工作流每天会抓取一次官方公告；也可以在 `Actions > Refresh balance data > Run workflow` 手动执行。
4. 若 GitHub 提示权限不足，在 `Settings > Actions > General` 中允许工作流读取和写入仓库内容。

本地更新完成后必须推送，否则 GitHub Pages 不会更新：

```bash
git add data/database data/raw data/config src/data/generated docs scripts .github README.md README.zh-CN.md README.en.md package.json
git commit -m "Update balance data"
git push origin main
```

## 数据安全

网页生产构建不显示导入、审核、草稿保存或数据管理入口。数据修改仅在本地完成，随后通过 Git 提交数据包和构建产物，保留完整历史与审核能力。
