// 数据卡片样式库（Data Card Style Liabrary）
// DataCardTemplates.tsx

// 项目在此处预置业务完备的数据卡片样式，每个数据卡片样式包括其 props 规范、以及可渲染的 UI 代码

// - 动态视图引擎将调度使用合适的数据卡片样式
// - 物的详情面板上各类数据卡片规整排列

import { useState, type ComponentType } from "react";
import { Activity, Video, FileText, Wrench, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buildFullUrl } from "@/services/http/httpClient";
import type { ActionAffordance, EventAffordance, PropertyAffordance, ThingDescription } from "@/types/td";

export interface RegistryRenderContext {
  thing: ThingDescription;
  key: string;
  property?: PropertyAffordance;
  action?: ActionAffordance;
  event?: EventAffordance;
}

export interface CardConfig<P extends object = object> {
  uiType: string;
  dataSourceType: "http" | "ws" | "static";
  description: string;
  propsSchema: Record<string, string>;
  component: ComponentType<P>;
  resolveProps: (context: RegistryRenderContext) => P;
}

function NumberCard({ title, value, loading = false, error }: { title: string; value: number | string | null; loading?: boolean; error?: string | null }) {
  return (
    <Card className="flex flex-col bg-primary/2 border-primary/20 relative overflow-hidden h-36 col-span-1">
      <CardHeader className="pt-0 pb-0 z-10 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-500 animate-pulse" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0 z-10 flex-1 flex items-center justify-center">
        <div className="flex items-baseline gap-1 mt-2">
          {loading ? (
            <span className="text-xl text-muted-foreground/50">...</span>
          ) : error ? (
            <span className="text-sm text-destructive text-center leading-tight">{error}</span>
          ) : value !== null && value !== undefined ? (
            <span className="text-5xl font-bold text-primary">{value}</span>
          ) : (
            <span className="text-xl text-muted-foreground/50">--</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


function SwitchCard({ title, isChecked, onToggle }: { title: string; isChecked: boolean; onToggle?: (checked: boolean) => void }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex items-center justify-between">
        <div className="flex items-center gap-2 mt-2">
          <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${isChecked ? "bg-green-500 text-green-500" : "bg-muted text-muted"}`} />
          <span className="font-semibold text-lg">{isChecked ? "开启" : "关闭"}</span>
        </div>
        {onToggle && <Switch checked={isChecked} onCheckedChange={onToggle} />}
      </CardContent>
    </Card>
  );
}

function VideoCard({
  title,
  frameSrc,
  open,
  onOpenChange,
  isLoading,
}: {
  title: string;
  frameSrc: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Card className="hover:border-primary/50 cursor-pointer transition-colors h-36 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 group col-span-2">
          <Video className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform group-hover:text-primary" />
          <span className="text-sm font-medium">{title}</span>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-6xl xl:max-w-7xl h-[85vh] flex flex-col p-0 overflow-hidden bg-black border-zinc-800">
        <DialogTitle className="sr-only">{title} Live Stream</DialogTitle>
        <DialogDescription className="sr-only">Live video stream for {title}</DialogDescription>
        <div className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center">
          {frameSrc ? (
            <img src={frameSrc} alt="Live Stream" className="w-full h-full object-contain" />
          ) : (
            isLoading && (
              <div className="flex flex-col items-center gap-4 animate-pulse text-zinc-500">
                <Video className="w-12 h-12" />
                <span>载入视频流中...</span>
              </div>
            )
          )}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-white/10">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            <span className="text-white text-xs font-mono font-medium tracking-wider">LIVE</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HtmlDocumentCard({ title, url }: { title: string; url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="hover:border-primary/50 cursor-pointer transition-colors h-36 flex flex-col items-center justify-center group col-span-2 md:col-span-1">
          <FileText className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform text-muted-foreground group-hover:text-primary" />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-6xl xl:max-w-7xl h-[85vh] flex flex-col p-0">
        <DialogTitle className="px-6 py-4 border-b font-medium">{title}</DialogTitle>
        <div className="flex-1 bg-white p-2">
          <iframe src={url} className="w-full h-full border-0" title={title} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionButtonCard({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={onClick}>
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{title}</span>
          <Wrench className="w-4 h-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function UnsupportedCard({ title, reason }: { title: string; reason: string }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 text-xs text-muted-foreground">{reason}</CardContent>
    </Card>
  );
}

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
    dataSourceType: "ws",
    description: "视频流卡片，用于显示实时监控视频或直播流",
    propsSchema: {
      title: "string - 卡片标题",
      url: "string - WebSocket 或 RTSP 流地址",
    },
    component: VideoCard,
    resolveProps: ({ key, property }) => ({
      title: property?.title || key,
      url: buildFullUrl(property?.forms?.[0]?.href || "", "ws"),
    }),
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