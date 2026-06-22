import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CardConfig } from "@/constants/DataCardTemplates";
import apiClient from "@/services/http/httpClient";
import { useThingSubscription } from "@/services/ws/useThingSubscription";

type VideoFramePayload = {
  frameType?: string;
  data?: string;
  t?: string;
  d?: string;
};

type CardWrapperProps = {
  cardConfig: CardConfig<any>;
  cardProps: Record<string, any>;
};

function NumberCardHttpWrapper({
  CardComponent,
  cardProps,
}: {
  CardComponent: any;
  cardProps: Record<string, any>;
}) {
  const { title, href, isObservable } = cardProps;
  // TODO: 当多个 observable 属性各自独立轮询时，应合并为批量请求
  //   POST /properties/batch { keys: [...] } 一次返回所有值
  const { data, isLoading, error } = useQuery({
    queryKey: ["property", href],
    queryFn: async () => {
      if (!href) throw new Error("Missing href");
      const res = await apiClient.get(href);
      return res.data;
    },
    refetchInterval: isObservable ? 5000 : false,
    enabled: !!href,
  });

  return (
    <CardComponent
      title={title}
      value={data ?? null}
      loading={isLoading}
      error={error ? (error instanceof Error ? error.message : "请求失败") : null}
    />
  );
}

function NumberCardWsWrapper({
  CardComponent,
  cardProps,
}: {
  CardComponent: any;
  cardProps: Record<string, any>;
}) {
  const { title, href } = cardProps;
  const { data, status, error } = useThingSubscription<number>(href, {
    enabled: !!href,
    parse: (payload) => {
      if (typeof payload === "number") return payload;
      if (payload && typeof (payload as any).value === "number") {
        return (payload as any).value;
      }
      return null;
    },
  });

  return (
    <CardComponent
      title={title}
      value={data ?? null}
      loading={status !== "connected"}
      error={error}
    />
  );
}

function VideoCardWrapper({
  CardComponent,
  cardProps,
}: {
  CardComponent: any;
  cardProps: Record<string, any>;
}) {
  const { title, videoUrl } = cardProps;
  const [open, setOpen] = useState(false);

  // HTTP/HTTPS 直连模式 (FLV 流等)
  const isHttpUrl = videoUrl && (videoUrl.startsWith("http://") || videoUrl.startsWith("https://"));

  useEffect(() => {
    console.log("[VideoCardWrapper] props:", {
      title,
      videoUrl,
      isHttpUrl,
      open,
    });
  }, [title, videoUrl, isHttpUrl, open]);
  
  if (isHttpUrl) {
    return (
      <CardComponent
        title={title}
        videoUrl={videoUrl}
        open={open}
        onOpenChange={setOpen}
      />
    );
  }

  // WebSocket 推流模式 (JPEG base64 帧)
  const { data, status } = useThingSubscription<string>(videoUrl, {
    enabled: open && !!videoUrl,
    parse: (payload) => {
      if (!payload) return null;
      if (typeof payload === "string") {
        return payload;
      }
      if (typeof payload === "object") {
        const framePayload = payload as VideoFramePayload;
        const frameType = framePayload.frameType ?? framePayload.t;
        const frameData = framePayload.data ?? framePayload.d;
        if (frameType === "jpeg" && frameData) {
          return frameData;
        }
      }
      return null;
    },
  });

  const frameSrc = data
    ? data.startsWith("data:")
      ? data
      : `data:image/jpeg;base64,${data}`
    : null;

  return (
    <CardComponent
      title={title}
      frameSrc={frameSrc}
      open={open}
      onOpenChange={setOpen}
      isLoading={status !== "connected"}
    />
  );
}

export function CardWrapper({ cardConfig, cardProps }: CardWrapperProps) {
  const CardComponent = cardConfig.component as any;

  if (cardConfig.uiType === "NumberCardHTTP") {
    return <NumberCardHttpWrapper CardComponent={CardComponent} cardProps={cardProps} />;
  }

  if (cardConfig.uiType === "NumberCardWS") {
    return <NumberCardWsWrapper CardComponent={CardComponent} cardProps={cardProps} />;
  }

  if (cardConfig.uiType === "VideoCard") {
    return <VideoCardWrapper CardComponent={CardComponent} cardProps={cardProps} />;
  }

  return <CardComponent {...cardProps} />;
}
