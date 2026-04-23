# Study Archive

学习整理网页（GitHub Pages 版）。

## 功能

- 新增/编辑学习记录
- 活跃区 / 归档区 / 主题索引 / 关键词图谱
- 从本地文件导入（txt / md / json / csv / docx / pdf）
- 支持通过 GitHub Pages 在线查看

## 项目文件

- `index.html`：页面结构
- `styles.css`：页面样式
- `app.js`：前端逻辑
- `records-data.js`：内置启动数据
- `.nojekyll`：确保 GitHub Pages 直接按静态站点发布

## GitHub Pages 发布步骤

### 1. 在 GitHub 创建仓库

仓库名：`study-archive`

### 2. 关联远程仓库

```bash
git remote add origin https://github.com/<你的用户名>/study-archive.git
```

如果已经有 origin：

```bash
git remote set-url origin https://github.com/<你的用户名>/study-archive.git
```

### 3. 提交并推送

```bash
git add .
git commit -m "Initial publish for GitHub Pages"
git branch -M main
git push -u origin main
```

### 4. 开启 GitHub Pages

GitHub 仓库页面 → `Settings` → `Pages`

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`

保存后，几分钟内会生成在线地址：

```text
https://<你的用户名>.github.io/study-archive/
```

## 重要说明

当前这个网页的“新增 / 编辑 / 归档”主要依赖浏览器本地存储（`localStorage`）+ `records-data.js` 启动数据：

- **在线查看**：没问题
- **跨设备自动同步编辑结果**：默认还不支持

也就是说：

- `records-data.js` 中的内容会作为在线初始数据展示
- 你在某台设备浏览器里临时新增/修改的内容，只会保存在那台设备的浏览器本地
- 如果要让新增内容永久出现在 GitHub Pages 在线版本里，需要把更新后的数据文件再次提交到仓库

## 后续可升级

如果你希望在线版支持真正的跨设备同步写入，下一步可以升级为：

1. GitHub Issues / GitHub API 驱动的数据写入
2. Supabase / Firebase 云数据库
3. 一个轻量后端（如 Vercel Functions / Cloudflare Workers）

目前这版最适合：

- 在线随时查看
- 轻量展示
- 手动发布更新
