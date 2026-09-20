# WoWS 平衡改动档案

## 用途

生产站点是只读的 GitHub Pages 改动浏览器。本地开发模式额外提供数据导入和数据管理工具，不会在生产网页中暴露写入入口。

## 官方公告数据库

`data/database/korabli-official.json` 是可提交到 Git 的公告数据包，包含开发博客近两年公告，以及官网 `korabli.su/ru/news/game-updates/` 从 26.9 开始的正式版本公告。历史数据保留，不因滚动时间窗口而删除。每条记录保存：

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
npm run test:data
npm run lint
npm run build
npm run data:review
npm run preview -- --host 127.0.0.1 --port 4173
```

预览地址为 `http://127.0.0.1:4173/LESTA_change_history/`。先审核 `outputs/official-review/README.md` 和 `review.json`，确认之后才执行下方发布命令。本地构建本身不会上传。需要文件包时另外运行 `npm run data:bundle`。

`npm run data:sync:official` 默认发现博客最近 730 天的公告，官网只读取 26.9 及后续版本。`KORABLI_DAYS` 仅调整博客范围。官网使用公开的 PJAX 正文接口，排除活动和销售章节；获取失败不会覆盖数据库或 TSV。Windows 使用系统代理，其他平台使用 Node fetch，均有限时和三次重试。

来源按博客、官网、人工区分；同舰船身份、同版本、同阶段、同属性且数值相同的改动合并来源，不跨测试/正式阶段去重。冲突候选保留在报告中，页面继续显示原值。未知舰船身份、无法解析的句子也会列入报告。维护者确认后修改数据库对应记录，再同步以核对结果；原文及关联来源不得删除。同步不会从博客推导或回退 `site.json.currentVersion`。

`npm run data:sync:official -- --replay` 可使用本次 `outputs/official-review/articles.json` 和 `snapshots/` 离线复查，不联网。快照和审核报告默认不提交。旧博客记录不会在每次同步时全部重解析；新版解析器接入的文章会重新核对，历史漏项需单独复查。

`npm run data:translate:zh` 会优先读取本机 `global.mo` 的舰船中文名，再通过本机 Claude 配置中的 DeepSeek 兼容网关翻译其余展示字段。凭据只在本机读取，绝不写入仓库；GitHub Actions 只使用已提交的翻译数据包。

如果词典移动位置，请在 PowerShell 中设置 `$env:WOWS_GLOBAL_MO_PATH='实际路径/global.mo'`。已审核的中文和翻译不会被机器翻译覆盖。未明确的历史版本显示“待确认”，等级显示罗马数字，超级舰船为 `⭐`。

如果需要继续使用整理好的 Excel 舰船日志，可运行 `npm run data:import:excel`。官方同步会以公告数据库重新生成三类 TSV，因此两种来源请在一次发布中择一作为主来源。

## GitHub Pages 与自动更新

1. 在 GitHub `Settings > Pages` 中选择从 `main` 分支的 `/docs` 发布。
2. 推送数据包后，`.github/workflows/refresh-data.yml` 会自动构建并提交新的 `docs/`。
3. 该工作流每天会抓取一次官方公告；也可以在 `Actions > Refresh balance data > Run workflow` 手动执行。
4. 若 GitHub 提示权限不足，在 `Settings > Actions > General` 中允许工作流读取和写入仓库内容。

仅在本地审核确认后推送，否则 GitHub Pages 不会更新。本次新增本地流程不修改现有线上定时任务，线上既有任务仍可能独立运行：

```bash
git add data/database data/raw data/config src docs scripts README.md README.zh-CN.md README.en.md package.json package-lock.json
git commit -m "Update balance data"
git push origin main
```

## 数据安全

网页生产构建不显示导入、审核、草稿保存或数据管理入口。数据修改仅在本地完成，随后通过 Git 提交数据包和构建产物，保留完整历史与审核能力。
# 本轮本地审核与导航

底部悬浮栏提供分类、搜索和筛选；按 Escape 关闭搜索面板。每舰默认只显示属性与前后数值，点击“展开版本与备注”可查看阶段和来源。正式状态需要官网证据，不能仅凭改动公告标题判定。

使用 `npm run data:import:localization -- "E:/Download/8863954.0.mo"` 更新舰船词典快照。`data/database/ship-name-overrides.json` 用国籍、等级、舰种和代码区分同名舰。旧译名仅作为搜索别名。

全量采集运行 `npm run data:sync:official -- --audit-only`；只读复查运行 `npm run data:sync:official -- --replay --review-only`。逐块报告位于 `outputs/official-review/coverage.json`，未批准候选不会自动入库。本轮不执行提交、推送或部署。
