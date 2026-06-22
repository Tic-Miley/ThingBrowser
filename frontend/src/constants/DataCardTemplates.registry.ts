// 数据卡片注册表（独立文件，避免 HMR Fast Refresh 不兼容问题）
// DataCardTemplates.registry.ts

import { buildFullUrl } from "@/services/http/httpClient";
import type { CardConfig, RegistryRenderContext } from "@/constants/DataCardTemplates";
import {
  NumberCard,
  SwitchCard,
  VideoCard,
  HtmlDocumentCard,
  ActionButtonCard,
  UnsupportedCard,
} from "@/constants/DataCardTemplates";

export const COMPONENT_REGISTRY: Record<string, CardConfig<any>> = {
  NumberCard: {
    uiType: "NumberCard",
    dataSourceType: "http",
    description: "数值遥测卡片，用于显示静态或一次性数值",
    propsSchema: {
      title: "string - 卡片标题",
      value: "number | string | null - 显示的数值",
      loading: "boolean - 加载状态指示器",
    },
    component: NumberCard,
    resolveProps: ({ key, property }) => ({
      title: property?.title || key,
      value: (property as any)?.value ?? null,
      loading: false,
    }),
  },
  NumberCardWS: {
    uiType: "NumberCardWS",
    dataSourceType: "ws",
    description: "WebSocket 数值卡片，用于通过 WS 长连接接收实时数据",
    propsSchema: {
      title: "string - 卡片标题",
      href: "string - WebSocket 连接地址",
      dataKey: "string - 数据键标识",
    },
    component: NumberCard,
    resolveProps: ({ key, property, thing }) => ({
      title: property?.title || key,
      href: buildFullUrl(property?.forms?.[0]?.href || "", "ws"),
      dataKey: `${thing.id}:${key}`,
    }),
  },
  NumberCardHTTP: {
    uiType: "NumberCardHTTP",
    dataSourceType: "http",
    description: "HTTP 数值卡片，支持定时轮询更新数据",
    propsSchema: {
      title: "string - 卡片标题",
      href: "string - HTTP 请求地址",
      isObservable: "boolean - 是否启用自动轮询",
      dataKey: "string - 数据键标识",
    },
    component: NumberCard,
    resolveProps: ({ key, property, thing }) => ({
      title: property?.title || key,
      href: buildFullUrl(property?.forms?.[0]?.href || "", "http"),
      isObservable: !!property?.observable,
      dataKey: `${thing.id}:${key}`,
    }),
  },
  SwitchCard: {
    uiType: "SwitchCard",
    dataSourceType: "static",
    description: "布尔状态卡片，用于显示/控制开关状态",
    propsSchema: {
      title: "string - 卡片标题",
      isChecked: "boolean - 开关状态",
      onToggle: "function - 开关切换回调",
    },
    component: SwitchCard,
    resolveProps: ({ key, property }) => ({
      title: property?.title || key,
      isChecked: !!(property as any)?.value,
      onToggle: undefined,
    }),
  },
  VideoCard: {
    uiType: "VideoCard",
    dataSourceType: "http",
    description: "视频流卡片，用于显示 HTTP-FLV / WebSocket JPEG 实时视频流",
    propsSchema: {
      title: "string - 卡片标题",
      videoUrl: "string - HTTP-FLV 流地址 或 WebSocket 推流地址",
    },
    component: VideoCard,
    resolveProps: ({ key, property }) => {
      const rawUrl = property?.forms?.[0]?.href || "";
      return {
        title: property?.title || key,
        videoUrl: buildFullUrl(rawUrl, rawUrl.startsWith("ws") ? "ws" : "http"),
      };
    },
  },
  HtmlDocumentCard: {
    uiType: "HtmlDocumentCard",
    dataSourceType: "http",
    description: "文档卡片，用于嵌入和显示 HTML 或 PDF 文档",
    propsSchema: {
      title: "string - 卡片标题",
      url: "string - 文档 URL",
    },
    component: HtmlDocumentCard,
    resolveProps: ({ key, property }) => ({
      title: property?.title || key,
      url: buildFullUrl(property?.forms?.[0]?.href || "", "http"),
    }),
  },
  ActionButtonCard: {
    uiType: "ActionButtonCard",
    dataSourceType: "static",
    description: "操作卡片，用于触发 Thing 的 Action 命令",
    propsSchema: {
      title: "string - 按钮标题",
      onClick: "function - 点击回调",
    },
    component: ActionButtonCard,
    // TODO: 未来需实现真实的 Action 调用：通过 action.forms 中的 href 发送 HTTP 请求
    resolveProps: ({ key, action }) => ({
      title: action?.title || key,
      onClick: () => {},
    }),
  },
  UnsupportedCard: {
    uiType: "UnsupportedCard",
    dataSourceType: "static",
    description: "兜底卡片，用于缺少 uiType 或未知 uiType 的场景",
    propsSchema: {
      title: "string - 卡片标题",
      reason: "string - 失败原因",
    },
    component: UnsupportedCard,
    resolveProps: ({ key, property, action, event }) => ({
      title: property?.title || action?.title || event?.title || key,
      reason: property ? "❌ 缺少 uiType 配置" : "❌ 未知卡片类型",
    }),
  },
};

export function getCardConfig(uiType: string | undefined): CardConfig<any> | null {
  if (!uiType) return null;
  return COMPONENT_REGISTRY[uiType] || null;
}

export function getAvailableCardTypes(): string[] {
  return Object.keys(COMPONENT_REGISTRY);
}
