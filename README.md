# 物浏览器（Thing Browser）

`frontend`为项目核心，包含完整的 Web 客户端代码，技术栈使用 **Vite + React + TypeScript + TailwindCSS + ShadcnUI**。

`backend` 仅是临时搭建的 Mock Server，用于验证前端通信能力，内部实现不作为重点。

## 快速运行

> 运行前请确保已安装 Node.js (建议 >= 16)。

### 1) 启动 Mock Server (可选)

> 前端开发模式下默认请求 `http://localhost:3000/api/v1`。如需本地联调，请先启动 `backend`。

```bash
cd backend
npm install
node server.js
```

- HTTP 端口: `http://localhost:3000`
- WS 端口: `ws://localhost:3000`

> Mock Server 中使用到`backend/mock-data`下的模拟数据，包括 HTML 文件（食堂菜单）和 MP4 视频（监控视频），如有需要可以自行提供文件。

### 2) 启动前端

```bash
cd frontend
npm install
```

在 `frontend/.env` 中配置：

```dotenv
VITE_BAIDU_MAP_AK=<你的百度地图AK>

# 可选: trace | debug | info | warn | error | silent
# VITE_LOG_LEVEL=debug
```

运行开发服务器：

```bash
npm run dev
```

- 访问地址: `http://localhost:5173`

## 项目结构

```text
ThingBrowser/
├── frontend/                # 核心 Web 客户端 (React + Vite)
└── backend/                 # Mock Server (Express)
```

## frontend 内部结构概览

```text
frontend/
├── public/                  # 静态资源
├── src/
│   ├── assets/              # 静态资源
│   ├── components/          # 通用组件（ShadcnUI 组件源码）
│   ├── constants/           # 项目的静态配置
│   ├── features/            # 业务功能模块
│   ├── hooks/               # 自定义 Hooks
│   ├── layouts/             # 布局
│   ├── pages/               # 页面入口
│   ├── services/            # HTTP/WS 封装与业务服务
│   ├── store/               # 全局状态管理
│   └── types/               # 类型定义
├── .env                     # 前端环境变量
└── vite.config.ts           # Vite 配置
```

## backend 内部结构概览

```text
backend/
├── mock-data/               # 模拟数据目录
├── search/                  # 搜索索引与查询逻辑
├── things/                  # 物的 TD 数据和拓扑结构
├── package.json             # 依赖配置
└── server.js                # Mock Server 入口
```
