// 数据卡片样式库（Data Card Style Liabrary）
// DataCardTemplates.tsx

// 项目在此处预置业务完备的数据卡片样式，每个数据卡片样式包括其 props 规范、以及可渲染的 UI 代码

// - 动态视图引擎将调度使用合适的数据卡片样式
// - 物的详情面板上各类数据卡片规整排列

import { useState, useCallback, useEffect, type ComponentType } from "react";
import { Activity, Video, FileText, Wrench, AlertTriangle, Loader2 } from "lucide-react";
import flvjs from "flv.js";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

export function NumberCard({ title, value, loading = false, error }: { title: string; value: number | string | null; loading?: boolean; error?: string | null }) {
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


export function SwitchCard({ title, isChecked, onToggle }: { title: string; isChecked: boolean; onToggle?: (checked: boolean) => void }) {
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

export function VideoCard({
  title,
  videoUrl,
  frameSrc,
  open,
  onOpenChange,
  isLoading,
}: {
  title: string;
  videoUrl?: string | null;
  frameSrc?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
}) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [playerState, setPlayerState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const isFlvMode = !!(videoUrl && (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")));

  // callback ref：在 Portal 中 video 元素挂载后触发
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    setVideoEl(el);
  }, []);

  // 独立的 flv.js 播放器 effect，依赖 videoEl 确保 DOM 已就绪
  useEffect(() => {
    if (!isFlvMode || !open || !videoUrl || !videoEl) {
      console.log("[VideoCard] skip init:", { isFlvMode, open, hasVideoUrl: !!videoUrl, hasVideoEl: !!videoEl });
      if (!videoEl) setPlayerState("idle");
      return;
    }

    console.log("[VideoCard] 开始连接 FLV 流:", videoUrl);

    let player: flvjs.Player | null = null;

    try {
      if (!flvjs.isSupported()) {
        console.error("[VideoCard] 当前浏览器不支持 flv.js (MSE 不可用)");
        setPlayerState("error");
        return;
      }

      player = flvjs.createPlayer({
        type: "flv",
        url: videoUrl,
        isLive: true,
        cors: true,
        withCredentials: false,
      } as flvjs.MediaDataSource);
      player.attachMediaElement(videoEl);
      player.load();
      setPlayerState("loading");
      console.log("[VideoCard] flv.js player 已创建，正在加载...");

      player.on(flvjs.Events.MEDIA_INFO, (info: any) => {
        console.log("[VideoCard] 媒体信息:", info);
        setPlayerState("playing");
      });

      player.on(flvjs.Events.ERROR, (_type: string, detail: any) => {
        console.error("[VideoCard] FLV 播放错误 - 类型:", _type);
        console.error("[VideoCard] FLV 播放错误 - 详情:", detail);
        if (detail && typeof detail === "object") {
          console.error("[VideoCard] 错误信息:", detail.msg || detail.message || JSON.stringify(detail));
        }
        setPlayerState("error");
      });

      player.on(flvjs.Events.LOADING_COMPLETE, () => {
        console.log("[VideoCard] FLV 流加载完成");
      });

      player.on(flvjs.Events.STATISTICS_INFO, (stats: any) => {
        console.log("[VideoCard] 流统计 - 速度:", stats?.speed, "KB/s, 已解码帧:", stats?.decodedFrames);
      });

      const playResult = player.play();
      if (playResult && typeof (playResult as Promise<void>).then === "function") {
        (playResult as Promise<void>)
          .then(() => {
            console.log("[VideoCard] play() 调用成功");
          })
          .catch((err: any) => {
            console.error("[VideoCard] play() 失败:", err);
          });
      } else {
        console.log("[VideoCard] play() 已调用，返回值为 void");
      }
    } catch (e) {
      console.error("[VideoCard] 初始化异常:", e);
      setPlayerState("error");
    }

    return () => {
      if (player) {
        try {
          player.pause();
          player.unload();
          player.detachMediaElement();
          player.destroy();
        } catch (_e) {
          // ignore cleanup errors
        }
      }
    };
  }, [open, videoUrl, isFlvMode, videoEl]);

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
          {/* FLV 模式：使用 flv.js + video 元素 */}
          {isFlvMode && (
            <>
              <video
                ref={videoCallbackRef}
                className="w-full h-full object-contain"
                muted
                playsInline
                autoPlay
                controls
                onPlaying={() => {
                  console.log("[VideoCard] <video> onPlaying 触发，画面开始渲染");
                  setPlayerState("playing");
                }}
              />
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur">
                <span className="font-mono tracking-wider">FLV</span>
                <span className="text-white/60">{playerState}</span>
              </div>
              {playerState === "loading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/60 text-zinc-400">
                  <Loader2 className="w-12 h-12 animate-spin" />
                  <span>载入视频流中...</span>
                </div>
              )}
              {playerState === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/60 text-red-400">
                  <Video className="w-12 h-12" />
                  <span>视频流加载失败，请检查网络连接</span>
                </div>
              )}
            </>
          )}

          {/* JPEG 帧模式（WebSocket 推流） */}
          {!isFlvMode && frameSrc && (
            <img src={frameSrc} alt="Live Stream" className="w-full h-full object-contain" />
          )}
          {!isFlvMode && !frameSrc && isLoading && (
            <div className="flex flex-col items-center gap-4 animate-pulse text-zinc-500">
              <Video className="w-12 h-12" />
              <span>载入视频流中...</span>
            </div>
          )}

          {/* LIVE 标识 */}
          {(playerState === "playing" || (!isFlvMode && frameSrc)) && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-white/10">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
              <span className="text-white text-xs font-mono font-medium tracking-wider">LIVE</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HtmlDocumentCard({ title, url }: { title: string; url: string }) {
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

export function ActionButtonCard({ title, onClick }: { title: string; onClick: () => void }) {
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

export function UnsupportedCard({ title, reason }: { title: string; reason: string }) {
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