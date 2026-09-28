# Dubbing Studio 本地开发与部署指南

**版本：BETA**  
**目标：**在本地启动 Dubbing Studio，完成类型检查、测试和生产构建，并为真实语音合成与视频导出接入独立处理节点。

## 1. 系统组成

Dubbing Studio 由四个主要部分组成：

- **前端：**`client/` 下的 React 19、Vite 和 Tailwind 4 界面；
- **应用服务：**`server/` 下的 Express、tRPC、身份验证、上传代理和处理节点代理；
- **数据层：**`drizzle/` 下的 MySQL/TiDB schema 与迁移；
- **处理节点：**独立的 GPT-SoVITS/音频处理服务，负责真实语音合成、音轨分离、混音和导出。

应用服务不直接在浏览器中运行 Demucs、GPT-SoVITS 或 FFmpeg。浏览器负责编辑交互和本地媒体预览，应用服务负责受保护的 API 和任务转发，处理节点负责重计算任务。

## 2. 前置要求

### 2.1 必需软件

| 软件 | 当前要求 | 用途 |
| --- | --- | --- |
| Node.js | 22 或更高版本 | 运行 TypeScript、Vite 和生产服务 |
| pnpm | 10.x，仓库锁定 10.4.1 | 安装依赖和执行脚本 |
| Git | 建议使用当前稳定版 | 获取源码和管理变更 |
| MySQL 或 TiDB | 生产环境需要 | 存储用户、项目、片段、版本、上传会话和任务数据 |

浏览器建议使用最新版本的 Chromium、Firefox 或 Safari。精细时间轴拖动和浏览器音频解码需要现代浏览器的 Pointer Events、Web Audio API、Cache Storage 和 IndexedDB/Storage 能力。

### 2.2 可选软件

如果要运行完整配音链路，还需要一个可访问的处理节点。当前推荐使用独立仓库中的 Docker 配置：

<https://github.com/hibobo/gpt-sovits-processing-node>

处理节点可以运行在带 NVIDIA GPU 的独立机器上。普通本地开发只启动 Dubbing Studio 即可，不需要在开发机上运行 GPU 模型。

## 3. 获取源码

```bash
gh repo clone hibobo/dubbing-studio
cd dubbing-studio
```

如果没有 GitHub CLI，也可以使用 Git：

```bash
git clone https://github.com/hibobo/dubbing-studio.git
cd dubbing-studio
```

安装依赖：

```bash
pnpm install
```

仓库使用 `pnpm-lock.yaml` 锁定依赖版本。提交代码前不要删除锁文件，也不要在未确认影响的情况下切换包管理器。

## 4. 环境变量

### 4.1 应用环境变量

应用服务从进程环境读取以下变量：

```dotenv
NODE_ENV=development
PORT=3000

# 身份验证和会话
VITE_APP_ID=your-manus-app-id
JWT_SECRET=replace-with-a-long-random-secret
OAUTH_SERVER_URL=https://api.manus.im
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=your-owner-name

# 数据库
DATABASE_URL=mysql://user:password@127.0.0.1:3306/dubbing_studio

# Manus 内置服务（按部署环境提供）
BUILT_IN_FORGE_API_URL=https://forge-api.example.com
BUILT_IN_FORGE_API_KEY=server-side-forge-key

# 处理节点，可选；启用真实试听和导出时必须配置
PROCESSING_NODE_URL=https://voice-node.example.com
PROCESSING_NODE_TOKEN=adapter-token
```

变量说明：

- `JWT_SECRET` 用于会话签名，必须使用随机长字符串，不要提交到 Git。
- `DATABASE_URL` 必须能被当前运行进程访问。生产环境不要使用开发库连接串。
- `VITE_APP_ID`、`OAUTH_SERVER_URL` 和其他 OAuth 变量需要与实际身份验证应用配置匹配。
- `BUILT_IN_FORGE_API_KEY` 和 `PROCESSING_NODE_TOKEN` 只能在服务端环境使用。
- `PROCESSING_NODE_URL` 可以为空。为空时，项目编辑功能仍可开发，但真实克隆试听和最终导出不可用。

### 4.2 不要提交 `.env`

建议在本地使用 `.env` 或由 IDE/进程管理器注入环境变量，并确认 `.gitignore` 已忽略它：

```bash
printf '\n.env\n.env.*\n!.env.example\n' >> .git/info/exclude
```

如果要为团队提供变量模板，应创建只包含变量名和占位符的 `.env.example`，不得放入真实数据库密码、OAuth 密钥、对象存储凭据、处理节点令牌或媒体地址。

## 5. 数据库初始化

确认 `DATABASE_URL` 已设置后，在项目根目录执行：

```bash
pnpm db:push
```

当前脚本执行：

1. `drizzle-kit generate` 生成迁移 SQL；
2. `drizzle-kit migrate` 将迁移应用到数据库。

开发时修改 `drizzle/schema.ts` 后，应再次运行：

```bash
pnpm db:push
```

提交 schema 变更前，检查 `drizzle/migrations/` 中生成的 SQL，并确认 TypeScript schema 与实际数据库结构一致。不要手工删除已经应用过的迁移文件。

## 6. 启动开发服务器

```bash
pnpm dev
```

当前开发脚本会运行：

```text
NODE_ENV=development tsx watch server/_core/index.ts
```

默认访问地址通常是：

```text
http://localhost:3000
```

如果运行环境通过代理或 WebDev 暴露端口，应使用环境提供的公开预览地址，而不是把内部管理地址写入文档或提交到仓库。

开发服务支持热更新。修改 `client/`、`server/` 或 `shared/` 下的源码后，观察终端日志确认服务重新编译。若端口已被占用，先停止旧的开发服务，或按项目运行环境的端口注入方式调整端口。

## 7. 开发验证命令

提交前至少运行：

```bash
pnpm check
pnpm test
pnpm build
```

各命令含义如下：

- `pnpm check`：运行 TypeScript 编译检查，不输出构建文件；
- `pnpm test`：运行 Vitest 测试；
- `pnpm build`：构建 Vite 前端，并用 esbuild 打包服务端到 `dist/`。

格式化命令为：

```bash
pnpm format
```

它会使用仓库中的 Prettier 配置写回文件。格式化后应再次运行 `pnpm check` 和 `pnpm test`。

## 8. 生产构建与启动

构建：

```bash
pnpm build
```

启动：

```bash
NODE_ENV=production pnpm start
```

或者直接运行构建产物：

```bash
NODE_ENV=production node dist/index.js
```

生产启动前请确认：

1. 所有服务端环境变量已经通过部署平台注入；
2. 数据库迁移已经应用；
3. 应用进程可以访问数据库、对象存储和处理节点；
4. 反向代理已经正确转发 HTTP 请求和登录回调；
5. Cookie 的安全属性、域名和 HTTPS 配置符合部署环境；
6. 不把 `PROCESSING_NODE_TOKEN` 或 `BUILT_IN_FORGE_API_KEY` 放进任何 `VITE_*` 变量。

## 9. 处理节点接入

### 9.1 配置地址和令牌

在 Dubbing Studio 服务端设置：

```dotenv
PROCESSING_NODE_URL=https://voice-node.example.com
PROCESSING_NODE_TOKEN=the-adapter-token
```

`PROCESSING_NODE_URL` 应指向处理节点适配器的根地址或文档约定的 API 地址。`PROCESSING_NODE_TOKEN` 必须与处理节点配置的令牌一致。

### 9.2 处理节点职责

处理节点适配器负责接受并执行：

- 单句试听任务；
- 试听任务状态查询和取消；
- 最终视频导出任务；
- 导出任务状态查询和取消；
- 已生成媒体文件下载。

Dubbing Studio 服务端在收到浏览器请求后，会先执行登录保护，再向处理节点转发请求。浏览器不应直接调用处理节点，也不应持有处理节点令牌。

### 9.3 连接检查

建议按以下顺序排查：

1. 从应用服务器执行处理节点健康检查；
2. 确认 DNS、TLS 和防火墙允许应用服务器访问处理节点；
3. 确认令牌没有多余空格或换行；
4. 确认处理节点能读取源视频和参考音频；
5. 提交一个短文本试听任务；
6. 再提交一个短视频导出任务。

详细请求字段、状态值、错误响应和 curl/Python 示例，请阅读：

<https://github.com/hibobo/gpt-sovits-processing-node/blob/main/docs/API.md>

## 10. 文件存储和媒体数据

视频、参考音频、生成语音和导出视频不应提交到 Git，也不应写入数据库 BLOB 字段。数据库应保存对象存储 URL、文件键、媒体元数据和任务状态，二进制内容应由 S3 兼容存储或处理节点的媒体存储负责。

本地开发时可以使用测试对象存储或部署平台提供的存储服务。不要把真实用户上传文件复制到 `client/public/` 或 `client/src/assets/`。这些目录会进入前端构建或静态资源发布流程，容易造成泄漏和构建超时。

## 11. 目录与修改边界

```text
client/
  src/pages/Home.tsx       # 配音工作台主界面
  src/components/          # 可复用 UI 组件
  src/lib/trpc.ts           # tRPC 客户端
server/
  routers.ts               # tRPC 路由入口
  db.ts                    # 数据库访问辅助函数
  _core/                   # 框架、OAuth、上下文和运行时基础设施
  storage.ts               # 存储辅助函数
drizzle/
  schema.ts                # 数据库表结构
  migrations/              # 迁移文件
shared/                    # 前后端共享类型和常量
docs/                      # 用户与开发文档
```

新增业务功能时，优先修改业务目录，不要直接改动 `server/_core/` 中的框架基础设施。涉及数据库时，应同步更新 schema、迁移、数据库辅助函数、tRPC 路由、前端调用和测试。

## 12. 推荐开发流程

1. 从 `main` 创建功能分支。
2. 先确认需求对应的现有路由、表和组件，避免重复实现。
3. 若修改数据库，先更新 `drizzle/schema.ts`，再生成并检查迁移。
4. 在服务端添加受保护的 tRPC procedure 或代理接口。
5. 在前端通过 tRPC 或既有服务端路由调用，不要绕过服务端鉴权直接访问内部服务。
6. 为成功、失败、加载、取消和空状态补充 UI。
7. 运行 `pnpm check`、`pnpm test` 和 `pnpm build`。
8. 手动验证桌面和窄屏布局，重点检查上传、拖动、试听、保存和回退。
9. 查看 `git diff`，确认没有 `.env`、媒体文件、日志、构建产物或令牌。
10. 提交清晰的 commit，并推送功能分支。

## 13. 常见开发问题

### `pnpm install` 报版本或锁文件错误

确认 Node.js 版本至少为 22，并使用 pnpm 10。执行：

```bash
node --version
pnpm --version
```

如果 pnpm 主版本不匹配，先切换到仓库要求的 pnpm 版本，再重新安装。不要直接删除锁文件来绕过依赖冲突。

### TypeScript 检查失败

先执行：

```bash
pnpm check
```

修复第一处类型错误后再继续。Dubbing Studio 使用 tRPC 推导前后端类型，通常应从服务端输入 schema 或共享类型入手修复，而不是在前端大量使用 `any`。

### 测试需要数据库或登录态

检查测试文件是否使用了正确的 mock、测试数据库和环境变量。不要把生产数据库连接串写入测试文件。涉及受保护 procedure 的测试，应覆盖匿名请求被拒绝和已登录请求成功两条路径。

### 浏览器能显示页面，但 API 返回未授权

这是预期的保护行为：当前页面可以在未登录时渲染部分结构，但上传、项目、版本和处理接口需要登录。要改变这个行为，应增加前端路由级登录守卫，同时保留服务端鉴权，不能只依赖浏览器判断。

### 处理节点任务卡在运行中

检查处理节点是否仍在运行、任务状态是否可查询，以及应用服务器到节点的网络是否稳定。当前前端使用轮询查询任务状态；实时 WebSocket/SSE 推送属于后续增强方向。

### 生产环境无法播放或下载媒体

检查对象存储 URL 的有效期、CORS、反向代理响应头和处理节点返回地址。不要把内部容器路径直接作为浏览器下载地址返回。

## 14. 安全清单

发布或部署前逐项确认：

- [ ] `.env`、数据库 URL、OAuth 密钥和处理节点令牌没有进入 Git；
- [ ] 处理节点令牌只存在于服务端环境；
- [ ] 上传视频、参考音频、模型和导出文件没有放入公开仓库；
- [ ] 所有项目、版本、上传和处理接口都经过服务端登录保护；
- [ ] 生产环境使用 HTTPS；
- [ ] 数据库账号只授予应用所需权限；
- [ ] 处理节点不直接暴露给不可信浏览器；
- [ ] 任务取消、失败和超时不会删除错误项目或版本；
- [ ] 日志中没有输出令牌、Cookie 或完整媒体签名 URL；
- [ ] 公开仓库只包含源码、迁移、测试和文档。

## 15. 当前实现边界

当前仓库已经提供完整的编辑工作台和处理节点代理契约，但以下部分仍依赖部署环境或后续开发：

- GPU 模型的实际运行；
- 参考音频上传和角色样本提取的完整接口绑定；
- 多格式、多码率和硬字幕导出；
- 处理任务的 WebSocket/SSE 实时推送；
- 更细粒度的逐片段降噪、混响匹配和响度标准化；
- 完整的前端路由级登录遮罩。

## 参考资料

[1]: https://github.com/hibobo/dubbing-studio "Dubbing Studio source repository"

[2]: https://github.com/hibobo/gpt-sovits-processing-node "GPT-SoVITS processing node repository"

[3]: https://github.com/hibobo/gpt-sovits-processing-node/blob/main/docs/API.md "GPT-SoVITS processing node API documentation"

[4]: https://nodejs.org/en/download "Node.js downloads"

[5]: https://pnpm.io/installation "pnpm installation guide"

[6]: https://orm.drizzle.team/docs/migrations "Drizzle ORM migrations documentation"
