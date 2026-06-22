# 食堂实时画面 (addVideo) 变更文档

> **变更日期**: 2026-06-22
> **分支**: `main`
> **上次提交**: `831fe58 init`

---

## 概述

本次更新包含两大变更主线：

1. **物模型重命名**：将 "联培基地食堂" 整体更名为 "政务服务中心食堂"
2. **新增视频播放能力**：为食堂物模型引入 "食堂实时画面" 属性，并通过集成 `flv.js` 实现萤石云 HTTP-FLV 实时视频流的浏览器端播放

---

## 一、物模型数据变更

### 1.1 `backend/things/TD/canteen.json` — 食堂 Thing Description

| 字段 | 旧值 | 新值 |
|------|------|------|
| `title` | `"联培基地食堂"` | `"政务服务中心食堂"` |
| `description` | `"联培基地的食堂"` | `"政务服务中心的食堂，为政务服务中心的工作人员和来访人员提供餐饮服务。物模型包含食堂人数监控、今日菜谱和食堂实时画面等属性。"` |
| `platform:address` | `"贵州省/贵阳市/高新区/联培基地食堂"` | `"贵州省/贵阳市/高新区/政务服务中心食堂"` |

**新增属性 `canteenVideo`**：

```json
"canteenVideo": {
  "title": "食堂实时画面",
  "description": "萤石云C2C摄像头实时画面，HTTP-FLV 流",
  "type": "string",
  "uiType": "VideoCard",
  "observable": false,
  "readOnly": true,
  "forms": [{
    "href": "https://rtmp04open.ys7.com:9188/v3/openlive/D80089996_1_1.flv?...",
    "contentType": "video/x-flv",
    "op": ["readproperty"]
  }]
}
```

关键设计决策：
- `uiType` 设为 `"VideoCard"`，由动态视图引擎匹配到 VideoCard 卡片组件
- `contentType` 为 `"video/x-flv"`，标识这是一个 FLV 视频流（区别于普通 HTTP/WS 数据端点）
- `href` 直接指向萤石云（Ezviz Cloud）的开放直播 FLV 地址，包含鉴权参数（`expire`、`id`、`t`、`ev`）
- `observable: false`，表示不需要前端轮询 — 播放由 flv.js 内部拉流机制驱动

**现有属性 URL 更新**：

| 属性 | 旧 href | 新 href |
|------|---------|---------|
| `peopleCount` | `http://localhost:3000/api/v1/proxy/...` | `http://bdff25ca.natappfree.cc/食堂/今日进入人数` |
| `todayMenu` | `http://localhost:3000/api/v1/proxy/...` | `http://f575af26.natappfree.cc/api/v1/proxy/...` |

> 两个属性的端点从本地代理 (`localhost:3000`) 迁移到了 natapp 内网穿透地址，表明后端数据源已迁移至外部服务。

### 1.2 `backend/things/topology.json` — 拓扑结构

单行 JSON 中的 `"gx-canteen"` 节点 `title` 从 `"联培基地食堂"` 更新为 `"政务服务中心食堂"`。其他节点（`gx-parking` 联培基地停车场、`gx-building` 联培基地大楼）保持不变。

---

## 二、前端依赖变更

### 2.1 `frontend/package.json`

新增依赖：

```json
"flv.js": "^1.6.2"
```

### 2.2 `frontend/package-lock.json`

自动生成的锁文件变更，新增以下包：

| 包名 | 版本 | 用途 |
|------|------|------|
| `flv.js` | 1.6.2 | HTTP-FLV 直播流播放引擎（基于 MSE） |
| `es6-promise` | 4.2.8 | flv.js 的 Promise polyfill 依赖 |
| `webworkify-webpack` | 2.1.5 | flv.js 的 Web Worker 打包依赖 |

---

## 三、前端架构变更

### 3.1 组件注册表分离 — `DataCardTemplates.registry.ts` (新文件)

**动机**：注释说明 "避免 HMR Fast Refresh 不兼容问题"。React Fast Refresh 要求包含组件导出和 hooks 的文件只导出组件；原 `DataCardTemplates.tsx` 既导出组件又导出 `COMPONENT_REGISTRY` 对象，可能导致 HMR 异常。

**做法**：将 `COMPONENT_REGISTRY`、`getCardConfig()`、`getAvailableCardTypes()` 从 `DataCardTemplates.tsx` 底部提取到独立的 `DataCardTemplates.registry.ts`，该文件通过 import 引用 `DataCardTemplates.tsx` 中导出的卡片组件。

**文件结构关系**：

```
DataCardTemplates.tsx (组件库)
  ├── 导出: NumberCard, SwitchCard, VideoCard,
  │         HtmlDocumentCard, ActionButtonCard, UnsupportedCard
  └── 导出类型: RegistryRenderContext, CardConfig

DataCardTemplates.registry.ts (注册表)
  ├── import 上述组件和类型
  ├── export COMPONENT_REGISTRY (Record<string, CardConfig>)
  ├── export getCardConfig()
  └── export getAvailableCardTypes()

DynamicViewEngine.tsx (调度引擎)
  └── import { COMPONENT_REGISTRY, getCardConfig }
        from "DataCardTemplates.registry"  ← 更新后的导入路径
```

**VideoCard 注册配置变更**（与旧版对比）：

| 字段 | 旧值 | 新值 |
|------|------|------|
| `dataSourceType` | `"ws"` | `"http"` |
| `description` | "视频流卡片，用于显示实时监控视频或直播流" | "视频流卡片，用于显示 HTTP-FLV / WebSocket JPEG 实时视频流" |
| props `url` | `string - WebSocket 或 RTSP 流地址` | — (已移除) |
| props `videoUrl` | — | `string - HTTP-FLV 流地址 或 WebSocket 推流地址` |
| `resolveProps` | 统一使用 `buildFullUrl(href, "ws")` | 智能判断：href 以 `ws` 开头则用 `"ws"` 构建，否则用 `"http"`；属性名从 `url` 改为 `videoUrl` |

### 3.2 VideoCard 组件重构 — `DataCardTemplates.tsx`

#### 新增导入

```typescript
import { useState, useCallback, useEffect } from "react";  // 新增 useCallback, useEffect
import { Loader2 } from "lucide-react";                     // 新增加载旋转图标
import flvjs from "flv.js";                                 // FLV 播放引擎
```

`buildFullUrl` 导入被移除（不再在组件文件中使用，仅 registry 文件需要）。

#### 组件导出

所有卡片组件从 `function` 改为 `export function`，以便 `DataCardTemplates.registry.ts` 跨文件引用。

#### VideoCard 双模式播放架构

VideoCard 现在支持两种互斥的播放模式，通过判断 `videoUrl` 是否为 HTTP(S) 来决定：

```
videoUrl 存在且以 http:// 或 https:// 开头?
  ├── 是 → FLV 模式（isFlvMode = true）
  │        使用 flv.js + <video> 元素
  │        通过 flvjs.createPlayer() 创建播放器实例
  │
  └── 否 → JPEG 帧模式（isFlvMode = false，WebSocket 推流）
            使用 <img> 标签显示 base64 JPEG 帧
            帧数据由 CardWrapper 通过 WebSocket 订阅获取
```

**FLV 模式详细流程**：

1. 使用 `useCallback` 创建 `videoCallbackRef`，在 Dialog（Portal）中 `<video>` 元素挂载后获取 DOM 引用
2. `useEffect` 依赖 `[open, videoUrl, isFlvMode, videoEl]`，在对话框打开且 video 元素就绪后初始化 flv.js
3. 调用 `flvjs.createPlayer()` 创建播放器，配置：
   - `type: "flv"` — 流类型
   - `isLive: true` — 直播模式（禁用 seek、启用低延迟缓冲）
   - `cors: true` — 启用跨域
   - `withCredentials: false` — 不发送凭据
4. 注册事件监听：
   - `MEDIA_INFO` → `playerState` 切为 `"playing"`
   - `ERROR` → `playerState` 切为 `"error"`
   - `LOADING_COMPLETE` → 日志记录
   - `STATISTICS_INFO` → 日志输出码率/解码帧统计
5. 调用 `player.play()`，处理同步/异步两种返回类型
6. 清理函数（组件卸载或依赖变化时）：`pause()` → `unload()` → `detachMediaElement()` → `destroy()`

**UI 状态覆盖**：

| 状态 | 视觉效果 |
|------|---------|
| `"loading"` | 全屏遮罩 + `Loader2` 旋转图标 + "载入视频流中..." |
| `"playing"` | 左上角 LIVE 红色脉冲标识 + 右上角 "FLV playing" 状态标签 |
| `"error"` | 全屏遮罩 + Video 图标 + "视频流加载失败，请检查网络连接" |

#### 函数签名变更

```typescript
// 旧版
function VideoCard({ title, frameSrc, open, onOpenChange, isLoading }: {
  title: string;
  frameSrc: string | null;     // 必填
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;          // 必填
})

// 新版
export function VideoCard({ title, videoUrl, frameSrc, open, onOpenChange, isLoading }: {
  title: string;
  videoUrl?: string | null;    // 新增，可选 — FLV 流 URL
  frameSrc?: string | null;    // 改为可选 — JPEG 帧 base64 data URL
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;         // 改为可选 — FLV 模式不需要
})
```

### 3.3 CardWrapper 适配 — `CardWrapper.tsx`

#### VideoCardWrapper 分支逻辑

```typescript
function VideoCardWrapper({ CardComponent, cardProps }) {
  const { title, videoUrl } = cardProps;  // url → videoUrl
  const [open, setOpen] = useState(false);

  const isHttpUrl = videoUrl && (videoUrl.startsWith("http://") || videoUrl.startsWith("https://"));

  if (isHttpUrl) {
    // FLV 直连模式：不需要 WebSocket 订阅，直接传 videoUrl 给组件
    return <CardComponent title={title} videoUrl={videoUrl} open={open} onOpenChange={setOpen} />;
  }

  // WebSocket JPEG 推流模式（保持原有逻辑）
  const { data, status } = useThingSubscription<string>(videoUrl, {
    enabled: open && !!videoUrl,
    parse: (payload) => { /* JPEG 帧解析逻辑不变 */ }
  });
  // ...将 data 转换为 frameSrc，传给 CardComponent
}
```

**关键变更**：
- 属性名从 `url` 改为 `videoUrl`（与 registry 的 `resolveProps` 输出一致）
- 新增 HTTP URL 检测分支：如果是 HTTP(S) 地址，直接跳过 WebSocket 订阅，让 VideoCard 内部的 flv.js 自行拉流
- 新增调试日志：`useEffect` 输出 props 到控制台（`[VideoCardWrapper] props: ...`）
- CSS 属性顺序微调：`frameSrc` 和 `open`/`onOpenChange` 的位置交换（无功能影响）
- 导入新增 `useEffect`、移除未使用的 `useState`（后又在 props 日志中加回 `useEffect`）

### 3.4 DynamicViewEngine 导入路径更新 — `DynamicViewEngine.tsx`

唯一的变更是导入源从主组件文件切换到注册表文件：

```typescript
// 旧
import { COMPONENT_REGISTRY, getCardConfig } from "@/constants/DataCardTemplates";
// 新
import { COMPONENT_REGISTRY, getCardConfig } from "@/constants/DataCardTemplates.registry";
```

这是注册表分离的配套变更，引擎本身的调度逻辑完全不变。

---

## 四、数据流全景

```
┌─────────────────────────────────────────────────────────────────────┐
│  萤石云 (Ezviz Cloud)                                               │
│  rtmp04open.ys7.com:9188/v3/openlive/...flv                         │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ HTTPS (HTTP-FLV 直播流)
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  canteen.json (Thing Description)                                   │
│  properties.canteenVideo.forms[0].href = "https://...flv"           │
│  properties.canteenVideo.uiType = "VideoCard"                       │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DataCardTemplates.registry.ts                                      │
│  VideoCard.resolveProps() → { title, videoUrl: "https://...flv" }   │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ cardProps = { title, videoUrl }
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CardWrapper.tsx → VideoCardWrapper                                 │
│  检测 videoUrl.startsWith("https://") → isHttpUrl = true            │
│  跳过 WebSocket 订阅，直接传递 videoUrl 给组件                       │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ props: { title, videoUrl, open, onOpenChange }
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DataCardTemplates.tsx → VideoCard                                  │
│  isFlvMode = true (videoUrl 是 HTTPS)                                │
│  用户点击卡片 → Dialog 打开 → useEffect 初始化 flv.js               │
│  flvjs.createPlayer() → attachMediaElement(<video>) → load() → play()│
│  画面渲染在 <video> 元素中，带 LIVE 标识和 FLV 状态标签              │
└─────────────────────────────────────────────────────────────────────┘
```

**WebSocket JPEG 帧模式（旧路径，仍保留）**：

```
WebSocket Server → useThingSubscription → parse JPEG base64
→ frameSrc = "data:image/jpeg;base64,..."
→ <img src={frameSrc} />
```

两种模式通过 `videoUrl` 是否以 `http://`/`https://` 开头自动切换，互不干扰。

---

## 五、变更文件清单

| 文件 | 变更类型 | 变更摘要 |
|------|---------|---------|
| `backend/things/TD/canteen.json` | 修改 | 重命名食堂、更新描述和地址、新增 `canteenVideo` 属性、更新现有属性 URL |
| `backend/things/topology.json` | 修改 | 拓扑节点标题从 "联培基地食堂" → "政务服务中心食堂" |
| `frontend/package.json` | 修改 | 新增 `flv.js` ^1.6.2 依赖 |
| `frontend/package-lock.json` | 修改 | 锁文件自动更新，新增 flv.js 及其传递依赖 |
| `frontend/src/constants/DataCardTemplates.tsx` | 重构 | 组件全部改为 `export function`；VideoCard 重写为双模式（FLV + JPEG）；新增 flv.js 播放逻辑和 UI 状态覆盖；移除底部注册表代码 |
| `frontend/src/constants/DataCardTemplates.registry.ts` | **新增** | 独立的组件注册表文件，包含 `COMPONENT_REGISTRY`、`getCardConfig()`、`getAvailableCardTypes()`；VideoCard 注册配置更新为 `dataSourceType: "http"` 并智能判断 URL 类型 |
| `frontend/src/features/details-panel/components/CardWrapper.tsx` | 修改 | `VideoCardWrapper` 新增 HTTP URL 检测分支；属性名 `url` → `videoUrl` |
| `frontend/src/features/details-panel/components/DynamicViewEngine.tsx` | 修改 | 导入源从 `DataCardTemplates` 切换到 `DataCardTemplates.registry` |

---

## 六、注意事项

1. **FLV 鉴权过期**：萤石云 FLV URL 中的 `expire` 参数（当前值 `1781269164`，对应约 2026 年 6 月）会过期，需定期通过萤石云 API 刷新直播地址。

2. **H.265 支持**：URL 参数 `supportH265=1` 表示摄像头输出 H.265 编码。flv.js 仅支持 H.264/AAC 解码 — 若实际流为 H.265，需在萤石云控制台将摄像头编码切换为 H.264，或改用支持 H.265 软解的播放方案（如 `mpegts.js`）。

3. **跨域配置**：flv.js 创建播放器时设置了 `cors: true`。萤石云直播域名需返回正确的 CORS 头部（`Access-Control-Allow-Origin`），否则浏览器将拒绝读取流数据。

4. **浏览器兼容性**：flv.js 依赖 Media Source Extensions (MSE)，iOS Safari 17+ 才完整支持；桌面端 Chrome/Firefox/Edge 现代版本均可使用。

5. **natapp 隧道稳定性**：`peopleCount` 和 `todayMenu` 属性端点指向 natappfree.cc 免费隧道，免费隧道的域名和端口可能在重启后变化，需注意维护。
