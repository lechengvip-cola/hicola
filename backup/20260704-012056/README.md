# Hi Cola

航空主题的个人主页与家庭入口站测试版。

## 部署说明

Cloudflare Pages 推荐设置：

- Framework preset: None
- Build command: 留空
- Build output directory: /
- Production branch: main

部署前检查：

- 确认仓库根目录存在 `index.html`
- 确认 `assets/css/style.css` 和 `assets/js/main.js` 存在
- 确认 Cloudflare Pages 项目名称为 `hicola`
- 确认自定义域名在 Cloudflare Pages -> hicola -> Custom domains 中添加 `hicola.net`
- 确认 Token 仅通过环境变量提供，不写入代码、README、日志或 Git 配置

## 文件结构

```text
index.html
_headers
_redirects
.nojekyll
assets/css/style.css
assets/js/main.js
assets/img/
README.md
```

## GitHub 推送

推荐提交信息：

```text
init: deploy Hi Cola static homepage
```

如果推送失败并提示权限不足，请检查 GitHub Token 是否具备仓库 Contents Read and write 权限。

## 隐私说明

页面仅展示公开昵称、兴趣方向和入口信息，不包含真实姓名、年龄、学校、班级、生日、地址等隐私信息。
