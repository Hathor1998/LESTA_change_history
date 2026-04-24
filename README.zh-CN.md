# WoWS 平衡改动本地工作台

## 项目定位

这个仓库现在分成两套能力：

1. 生产站点：只读浏览平衡改动归档
2. 本地开发站点：额外提供“数据导入”和“数据管理”工具页

正式数据真源固定为：

- `data/raw/ship.tsv`
- `data/raw/mechanic.tsv`
- `data/raw/misc.tsv`
- `data/config/site.json`

前端实际读取的是构建产物：

- `src/data/generated/balanceChanges.json`

## 数据流

推荐维护流程如下：

1. 如需从根目录 Excel 重建正式舰船真源，运行 `npm run data:import:excel`
2. 运行 `npm run dev`
3. 在本地工具页里导入官网正文或上传 `.xlsx/.csv/.tsv`
4. 手动审核字段、补充版本号、调整测试船状态和别名
5. 将有效记录追加到本地源数据，或按分类替换本地源数据
6. 导出 `data/raw/*.tsv` 与 `site.json`
7. 运行 `npm run data:validate`
8. 运行 `npm run data:build`
9. 运行 `npm run build`
10. 运行 `npm run data:bundle`
11. 手动提交或上传到 GitHub

## 本地工具说明

### 1. 数据导入

支持两种识别路径：

- 结构化表格：TSV / CSV / Excel 行数据
- 公告正文：船名标题 + 多条自然语言改动描述

公告正文模式会处理以下场景：

- `主炮装填时间从7秒减少到5.8秒`
- `对海隐蔽从9.3km减少到8.1km`
- `调整了“侦察机”消耗品的参数`
- `冷却时间从240秒减少到120秒`
- `作用时间从100秒增加到160秒`

其中“侦察机”这种父级上下文会自动传给后续子句，形成 `侦察机-冷却时间`、`侦察机-作用时间` 这类属性名。

### 2. 数据管理

本地数据管理页用于维护准备写回仓库的源数据快照，支持：

- 浏览与筛选现有真源记录
- 新增、修改、删除记录
- 维护 `canonicalName`、`previousNames`、`shipStatus`、`tags`
- 修改 `currentVersion` 与 `lastUpdated`
- 导出分类 TSV
- 导出 `site.json`

浏览器端不会直接写仓库文件；导出后的文件需要你手动覆盖仓库真源。

## Excel 导入规则

`npm run data:import:excel` 会自动在项目根目录寻找 `.xlsx` 工作簿，优先匹配名称里带 `Lesta` 的文件。

脚本固定行为：

- 读取 `查询` sheet
- 读取 `非测试舰船` sheet
- 忽略空的 `测试舰船` sheet
- 仅覆盖 `data/raw/ship.tsv`
- 自动把 `船名` 中的 `/` 拆成 `canonicalName + previousNames`
- 自动把 `site.json.currentVersion` 更新为 `查询` 页中的“当前版本”

## 生命周期与标签

当前支持的核心扩展字段有：

- `canonicalName`
- `previousNames`
- `shipStatus`
- `tags`
- `sourceSheet`

标签推导规则：

- `shipStatus=test` 自动加 `test-ship`
- `shipStatus=released` 自动加 `released-ship`
- `previousNames` 非空自动加 `name-change`
- 正式船与测试船在规范名、显示名或别名上命中时，正式船自动加 `converted-from-test`

当前如果没有测试船真源，`converted-from-test` 允许为 0；后续补录测试船数据后，重新构建即可自动推导。

## 原始 TSV 结构

所有真源 TSV 固定为 15 列：

```tsv
targetName	canonicalName	previousNames	nation	tier	type	attribute	oldValue	newValue	version	notes	trend	shipStatus	tags	sourceSheet
```

规则：

- `previousNames` 用 `|` 分隔
- `tags` 用 `|` 分隔
- `trend` 允许值：`buff | nerf | neutral | adjustment`
- `shipStatus` 允许值：`test | released | unknown`

## 常用命令

安装依赖：

```bash
npm install
```

本地开发：

```bash
npm run dev
```

Excel 重建正式舰船真源：

```bash
npm run data:import:excel
```

校验真源：

```bash
npm run data:validate
```

生成前端数据：

```bash
npm run data:build
```

类型检查：

```bash
npm run lint
```

生成生产构建：

```bash
npm run build
```

输出本地更新包：

```bash
npm run data:bundle
```

## GitHub Pages 部署指南

### 1. 确认 Vite base

检查 `vite.config.ts` 中的 `base`，它必须与 GitHub Pages 仓库路径一致。

### 2. 本地完整验证

```bash
npm run lint
npm run data:import:excel
npm run data:validate
npm run data:build
npm run build
npm run data:bundle
```

### 3. 发布内容

至少需要提交这些内容：

- `data/raw/*.tsv`
- `data/config/site.json`
- `src/data/generated/balanceChanges.json`
- `docs/`
- 相关源码与文档更新

### 4. 在 GitHub 开启 Pages

在仓库设置中：

1. 打开 `Settings`
2. 打开 `Pages`
3. `Build and deployment` 选择 `Deploy from a branch`
4. 选择发布分支
5. 选择 `/docs`

### 5. 生产站点说明

GitHub Pages 生产站点只显示只读浏览界面，不会暴露“数据导入”和“数据管理”入口。这是为了避免线上误操作和数据安全风险。
