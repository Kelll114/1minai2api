# 1min.ai 反向代理

一个将 1min.ai API 转换为 OpenAI 兼容格式的 Deno 反向代理服务，支持 JWT token 管理和自动过期检测。

## ✨ 功能特性

- 🔄 **OpenAI 兼容 API**：提供完全兼容 OpenAI Chat Completion 格式的接口
- 🔐 **JWT Token 管理**：支持添加、禁用、启用、删除 1min.ai JWT tokens
- 📝 **Token 备注**：为每个 token 添加备注，方便管理
- ⏰ **自动过期检测**：智能检测并禁用过期的 tokens
- 💾 **Deno KV 存储**：使用 Deno 内置的键值存储数据库
- 🎯 **用户信息缓存**：缓存 1min.ai 用户信息，减少 API 请求
- 📊 **Web 管理界面**：提供友好的 Web 界面管理 tokens
- 🔒 **认证保护**：管理 API 使用独立的认证秘钥保护

## 🚀 快速开始

### 前置要求

- [Deno](https://deno.land/) >= 1.40.0

### 安装运行

1. **克隆项目**

```bash
git clone https://github.com/CassiopeiaCode/1minai2api.git
cd 1minai2api
```

2. **配置环境变量**

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
# PORT=8000                                    # 服务器端口
# AUTH_SECRET=your-secret-key-here             # 管理 API 认证秘钥
```

3. **启动服务**

```bash
# 开发模式
deno task dev

# 生产模式
deno task start
```

服务将在 `http://localhost:8000` 启动。

## 📖 使用说明

### Web 管理界面

访问 `http://localhost:8000` 打开 Web 管理界面。

**功能：**
- 添加新的 1min.ai JWT token
- 查看所有 tokens 及其状态
- 禁用/启用 tokens
- 修改 token 备注
- 删除 tokens
- 实时统计信息

### OpenAI 兼容 API

项目提供与 OpenAI 完全兼容的 API 端点。

**重要说明：** API 使用 `AUTH_SECRET` 进行认证，系统会自动从数据库中随机选择一个可用的 1min.ai token 来处理请求。

**端点：** `POST /v1/chat/completions`

**请求示例：**

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

**流式响应示例：**

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "stream": true
  }'
```

**支持的模型映射：**

| OpenAI 模型 | 1min.ai 模型 |
|------------|-------------|
| gpt-4 | claude-opus-4-1-20250805 |
| gpt-4o | claude-opus-4-1-20250805 |
| gpt-3.5-turbo | claude-sonnet-3-5-20240229 |
| claude-3-opus | claude-opus-4-1-20250805 |
| claude-3-sonnet | claude-sonnet-3-5-20240229 |

### 管理 API

所有管理 API 都需要在请求头中包含认证秘钥：

```
Authorization: Bearer YOUR_AUTH_SECRET
```

#### 1. 添加 Token

```bash
POST /admin/tokens
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_SECRET

{
  "token": "eyJhbGci...",
  "note": "测试账号"
}
```

#### 2. 列出所有 Tokens

```bash
GET /admin/tokens
Authorization: Bearer YOUR_AUTH_SECRET
```

#### 3. 禁用 Token

```bash
POST /admin/tokens/{token}/disable
Authorization: Bearer YOUR_AUTH_SECRET
```

#### 4. 启用 Token

```bash
POST /admin/tokens/{token}/enable
Authorization: Bearer YOUR_AUTH_SECRET
```

#### 5. 删除 Token

```bash
DELETE /admin/tokens/{token}
Authorization: Bearer YOUR_AUTH_SECRET
```

#### 6. 修改 Token 备注

```bash
PUT /admin/tokens/{token}/note
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_SECRET

{
  "note": "新的备注"
}
```

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务器端口 | `8000` |
| `AUTH_SECRET` | 管理 API 认证秘钥 | `your-secret-key-here` |

### Token 管理

- ✅ **自动过期检测**：系统每小时自动检查并禁用过期的 tokens
- 📦 **用户信息缓存**：用户信息缓存 1 小时，减少 API 请求
- 🔍 **JWT 解析**：自动解析 JWT token 获取过期时间

## 📁 项目结构

```
1min.ai/
├── main.ts           # 主服务器文件
├── proxy.ts          # 反向代理逻辑
├── database.ts       # Deno KV 数据库管理
├── jwt.ts            # JWT token 解析和验证
├── types.ts          # TypeScript 类型定义
├── config.ts         # 配置文件
├── deno.json         # Deno 配置
├── .env              # 环境变量（需自行创建）
├── .gitignore        # Git 忽略文件
├── public/           # 静态文件（Web 管理界面）
│   └── index.html    # 管理界面
└── README.md         # 项目文档
```

## 🛡️ 安全建议

1. **保护认证秘钥**：请务必修改默认的 `AUTH_SECRET`，使用强密码
2. **HTTPS 部署**：生产环境建议使用 HTTPS
3. **访问控制**：建议配置防火墙规则限制管理 API 的访问
4. **定期清理**：定期清理不再使用的 tokens

## 🐛 故障排除

### 无法启动服务

- 检查端口是否被占用
- 确保 Deno 版本 >= 1.40.0
- 检查权限配置

### Token 验证失败

- 确认 token 格式正确（JWT 格式）
- 检查 token 是否已过期
- 验证 token 是否已被禁用

### API 请求失败

- 检查 1min.ai API 是否可访问
- 验证 token 的有效性
- 查看服务器日志获取详细错误信息

## 📝 开发说明

### 运行测试

```bash
deno test --allow-all
```

### 代码格式化

```bash
deno fmt
```

### 代码检查

```bash
deno lint
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [1min.ai 官网](https://1min.ai)
- [Deno 官网](https://deno.land)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)

## 💡 提示

这个项目仅用于学习和研究目的，请遵守 1min.ai 的服务条款。