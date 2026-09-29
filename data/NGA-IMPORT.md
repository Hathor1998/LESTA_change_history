# NGA 中文公告审核导入

`npm run data:import:nga` 仅重放已审核的帖子 47645187，不是通用爬虫，不会自动扫描或登录 NGA。

1. 在获授权的本地浏览器正常打开帖子，读取主楼，排除广告与普通回帖，不导出 Cookie。
2. 记录版本、译者、发布日期、舰船原文名及国籍/等级/舰种，保留嵌套层级。
3. 对照官方公告；未知旧值不填零，同版本不同轮次保留历史，数值冲突待审。
4. 本批审核数据在 `scripts/nga-47645187.ts`。导入前在线核验官方原文，获取失败或原文变化时停止。
5. 执行 `npm run data:import:nga`，阅读 `outputs/nga-review/README.md` 与 `review.json`。
6. 执行 `npm run lint`、`npm run test:data`、`npm run build`，本地预览后再决定发布。

本批8艘舰船、22项改动全部接纳；三笠04按用户确认采用官网1.9→1.8，NGA的1.8→1.65保留为来源差异。
译者：ViisasSusi。中文来源：https://bbs.nga.cn/read.php?tid=47645187 ；官方核对：https://blog.korabli.su/blog/697 。

记录保留双来源；NGA文本为结构化转录，不保存完整论坛页面或其他用户资料。名称优先沿用游戏词典，NGA译名保留在备注中供搜索。
