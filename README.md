# Hi Cola

Hi Cola 个人主页测试版，基于 [imsyy/home](https://github.com/imsyy/home) 模板进行最小修改。

## Build

```bash
pnpm install
pnpm build
```

构建输出目录：`dist`。

## 成长相册部署、权限、密码设置和日常使用说明

成长相册新增了独立页面和 Cloudflare Pages Functions API：

- 家庭入口：`/album`
- 管理后台：`/admin/album`
- 快速上传：`/admin/album/upload`
- 待整理箱：`/admin/album/pending`
- 已发布相册：`/admin/album/published`
- 系统设置：`/admin/album/settings`

### Cloudflare 资源

需要创建并绑定：

1. D1 数据库：建议名称 `hicola-album`
2. R2 私有 Bucket：建议名称 `hicola-album-private`
3. Cloudflare Access：保护 `/admin/*`

`wrangler.toml` 已包含绑定模板：

```toml
[[d1_databases]]
binding = "DB"
database_name = "hicola-album"
database_id = "REPLACE_WITH_D1_DATABASE_ID"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "ALBUM_BUCKET"
bucket_name = "hicola-album-private"
```

创建 D1 后把真实 `database_id` 填入 Cloudflare Pages 的绑定配置或 `wrangler.toml`。R2 Bucket 必须保持私有，不要开启公开访问。

### D1 Migration

```bash
npx wrangler d1 migrations apply hicola-album --remote
```

会创建：

- `album_events`
- `album_media`
- `upload_batches`
- `upload_errors`
- `album_security_settings`
- `family_sessions`
- `album_login_attempts`

### 环境变量和 Secrets

Cloudflare Pages 生产环境建议设置：

- `SESSION_SECRET`：用于会话和 IP 哈希的随机密钥
- `ADMIN_EMAILS`：允许进入相册后台的管理员邮箱，多个邮箱用英文逗号分隔
- `ALBUM_TIMEZONE=Asia/Shanghai`
- `MAX_UPLOAD_SIZE=52428800`
- `ENVIRONMENT=production`

本地开发可选：

- `DEV_ADMIN_TOKEN`：仅非 production 环境允许通过 `x-dev-admin-token` 调试管理员接口

不要把真实密码、Token 或密钥写入前端代码或 GitHub。

### Cloudflare Access

在 Cloudflare Zero Trust 中创建 Access Application：

- 保护路径：`https://hicola.net/admin/*`
- 登录策略：允许管理员邮箱
- Pages Function 会读取 `cf-access-authenticated-user-email`，并和 `ADMIN_EMAILS` 比对

不能只靠前端隐藏后台按钮。

### 首次设置家庭密码

1. 管理员通过 Cloudflare Access 打开 `/admin/album/settings`
2. 在“设置或修改家庭密码”中输入两次家庭密码
3. 保存后再开启“家庭相册访问”

家庭密码保存在 D1，使用 PBKDF2-SHA-256、随机 salt 和迭代次数，不会写入前端。

### 修改或忘记家庭密码

管理员进入 `/admin/album/settings`，直接输入新密码并保存。保存后：

- `family_password_version` 增加
- 所有旧家庭会话立即失效
- 家庭设备需要重新登录
- 管理员 Access 登录不受影响

### 退出所有家庭设备

在 `/admin/album/settings` 点击“退出所有家庭设备”。该操作只撤销家庭会话，不改变家庭密码。

### 暂时关闭家庭相册

在 `/admin/album/settings` 关闭“开启家庭相册访问”。关闭后：

- `/album` 显示相册暂时关闭
- 家庭 Cookie 即使存在也不能读取相册和照片
- 管理员后台仍可使用

### 日常使用

1. 管理员进入 `/admin/album/upload`
2. 拖入照片、视频或文件夹，或点击选择照片和视频
3. 系统计算 SHA-256，检测完全重复文件
4. 浏览器生成缩略图和预览图
5. 文件写入私有 R2，元数据写入 D1
6. 上传内容进入“待整理箱”
7. 管理员点击“确认并发布全部”
8. 家庭成员通过 `/album` 输入家庭密码查看

### 本地开发

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

Cloudflare Pages Functions 需要使用 wrangler 或 Cloudflare Pages 本地环境进行完整联调：

```bash
npx wrangler pages dev dist --d1 DB=<local-db> --r2 ALBUM_BUCKET=<local-bucket>
```

### 部署

```bash
pnpm build
npx wrangler pages deploy dist --project-name hicola --branch main
```

### 第一版已实现

- 首页成长相册入口接入 `/album`
- 家庭密码服务器端验证
- 家庭密码设置、修改、重置
- 修改密码后旧家庭会话失效
- 一键退出所有家庭设备
- 家庭访问开关
- 管理员独立认证入口，推荐 Cloudflare Access
- D1 migration
- R2 私有媒体存储接口
- 多文件选择、拖拽上传、文件夹上传、手机上传
- 上传进度、失败重试
- SHA-256 完全重复检测
- EXIF/文件时间日期归档
- 浏览器端缩略图和预览图生成
- 待整理箱和一键发布
- 全部照片、年份筛选、精选成长
- 相册详情页和全屏浏览
- 受保护媒体接口
- 管理员修改标题、发布、隐藏/删除基础能力

### 预留但不阻碍上线

- AI 识别照片内容
- 人脸识别
- 感知哈希相似照片
- 评论系统
- 家庭成员独立账号
