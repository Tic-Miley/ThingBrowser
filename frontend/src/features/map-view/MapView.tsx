// 地图组件
// 使用百度地图 API，显示地图、显示物标记点、提供交互等

import { useEffect, useRef, useState } from "react";
import { useGlobalStore } from "@/store/useGlobalStore";
import { fetchThingsInBbox, fetchThingTd } from "@/services/http/thingService";
import { createLogger } from "@/services/logger";
import { HoverCard } from "./HoverCard";
import { useHoverCard } from "./useHoverCard";

const log = createLogger("BaiduMap");

// ==========================================
// 模块级常量：Marker HTML 模板
// ==========================================
const NORMAL_MARKER_HTML = `
  <div style="pointer-events:auto;" class="relative flex items-center justify-center w-6 h-6 hover:scale-110 transition-transform cursor-pointer">
    <div class="w-3 h-3 bg-muted-foreground/80 rounded-full shadow-md border-2 border-background"></div>
  </div>
`;

const ACTIVE_MARKER_HTML = `
  <div class="relative flex items-center justify-center w-8 h-8">       
    <div class="absolute inset-0 rounded-full border-2 border-primary animate-ping"></div>
    <div class="absolute inset-0 rounded-full bg-primary opacity-20"></div>
    <div class="relative w-4 h-4 bg-primary rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] border-[2.5px] border-background"></div>
  </div>
`;


// ==========================================
// BBOX 请求缓存（相同区域 5 秒内复用）
// ==========================================
const bboxCache = new Map<string, { data: any[]; ts: number }>();
const BBOX_CACHE_TTL = 5000;

function getCachedBbox(bboxKey: string): any[] | null {
  const entry = bboxCache.get(bboxKey);
  if (entry && Date.now() - entry.ts < BBOX_CACHE_TTL) {
    return entry.data;
  }
  bboxCache.delete(bboxKey);
  return null;
}

function setCachedBbox(bboxKey: string, data: any[]) {
  // 清理过期条目防止内存泄漏
  const now = Date.now();
  for (const [k, v] of bboxCache) {
    if (now - v.ts > BBOX_CACHE_TTL * 2) bboxCache.delete(k);
  }
  bboxCache.set(bboxKey, { data, ts: now });
}

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<{ [urn: string]: any }>({});
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCenterRef = useRef<{ lng: number; lat: number; zoom: number } | null>(null);
  const prevActiveUrnRef = useRef<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeThingUrn = useGlobalStore(s => s.activeThingUrn);
  const setActiveThingUrn = useGlobalStore(s => s.setActiveThingUrn);
  const setBusinessError = useGlobalStore(s => s.setBusinessError);

  // 用 ref 桥接 stale closure：事件监听器绑定于首次渲染，需通过 ref 读取最新值
  const activeThingUrnRef = useRef(activeThingUrn);
  activeThingUrnRef.current = activeThingUrn;

  // ==========================================
  // Hover Card 集成
  // ==========================================
  const {
    hoverState,
    hoverPosition,
    handleMarkerEnter,
    handleMarkerLeave,
    handleCardEnter,
    handleCardLeave,
  } = useHoverCard({
    mapInstance,
    mapContainer,
    activeThingUrn,
  });

  // 使用 ref 存储 hover 事件处理器引用，供标记的闭包回调使用
  // 避免在标记创建时因闭包 stale 而丢失最新的处理器
  const hoverHandlersRef = useRef({
    handleMarkerEnter,
    handleMarkerLeave,
  });
  hoverHandlersRef.current = { handleMarkerEnter, handleMarkerLeave };

  const fetchAndRenderMarkers = () => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      actualFetchAndRender();
    }, 400);
  };

  // 获取并渲染 Markers
  const actualFetchAndRender = async () => {
    if (!mapInstance.current) return;
    
    // 增添容差算法：位移距离过小且层级没变，则阻断请求
    const center = mapInstance.current.getCenter();
    const zoom = mapInstance.current.getZoom();
    
    if (lastCenterRef.current) {
      const dx = Math.abs(center.lng - lastCenterRef.current.lng);
      const dy = Math.abs(center.lat - lastCenterRef.current.lat);
      const dz = Math.abs(zoom - lastCenterRef.current.zoom);
      // 容差：经纬度 0.008 度（约 800m）、缩放 ±1 级以内忽略
      if (dz <= 1 && dx < 0.008 && dy < 0.008) {
        return;
      }
    }
    lastCenterRef.current = { lng: center.lng, lat: center.lat, zoom };

    const bounds = mapInstance.current.getBounds();
    if (!bounds) return;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const BMapGL = (window as any).BMapGL;

    if (sw && ne) {
      setErrorMessage(null);
      try {
        // BBOX 按 1.2 倍扩展，预加载视口外 Marker，减少小幅拖拽时的重复请求
        const midLat = (sw.lat + ne.lat) / 2;
        const midLng = (sw.lng + ne.lng) / 2;
        const expandLat = (ne.lat - sw.lat) * 0.6; // 两侧各扩展 10%
        const expandLng = (ne.lng - sw.lng) * 0.6;
        const expandedBbox = `${midLng - expandLng},${midLat - expandLat},${midLng + expandLng},${midLat + expandLat}`;

        // 请求缓存：同一 BBOX 5 秒内直接复用
        let items = getCachedBbox(expandedBbox);
        if (!items) {
          items = await fetchThingsInBbox(expandedBbox);
          setCachedBbox(expandedBbox, items);
        }
        setBusinessError(null);

        // 差异化更新：移除不在新集合的点，新增缺失的点，保留已有点以避免闪烁
        const fetchedSet = new Set(items.map((it: any) => it.urn));
        const existingUrns = Object.keys(markersRef.current);

        // remove overlays that are no longer in fetched items (Set.has is O(1))
        existingUrns.forEach((urn) => {
          if (!fetchedSet.has(urn)) {
            try { mapInstance.current.removeOverlay(markersRef.current[urn]); } catch (e) { log.warn("removeOverlay failed", e); }
            delete markersRef.current[urn];
          }
        });

        // 渲染或更新新点
        // TODO: 未来缩放到小级别时 Marker 密集重叠，可引入 BMapLib.MarkerClusterer 聚合
        items.forEach((markerData: any) => {
          // 如果已经存在，不需重新创建（可在此处更新样式/位置，如需）
          if (markersRef.current[markerData.urn]) return;

          const position = new BMapGL.Point(markerData.location[0], markerData.location[1]);
          const marker = new BMapGL.Label(NORMAL_MARKER_HTML, {
            position: position,
            offset: new BMapGL.Size(-12, -12) // anchor center
          });

          // 覆盖默认的Label样式
          marker.setStyle({
            color: "inherit",
            backgroundColor: "transparent",
            border: "none",
            padding: "0",
            fontSize: "inherit"
          });

          // 注册点击事件（仅设置 URN，由 useEffect 统一处理高亮与飞行）
          marker.addEventListener('click', () => {
            setActiveThingUrn(markerData.urn);
          });

          // 注册 hover 事件（Baidu Map GL 支持 mouseover / mouseout）
          marker.addEventListener('mouseover', () => {
            hoverHandlersRef.current.handleMarkerEnter(
              markerData.urn,
              markerData.title,
              { lng: markerData.location[0], lat: markerData.location[1] },
            );
          });
          marker.addEventListener('mouseout', () => {
            hoverHandlersRef.current.handleMarkerLeave();
          });

          mapInstance.current.addOverlay(marker);
          markersRef.current[markerData.urn] = marker;
        });

        // only update marker visual states, do NOT recenter the map here
        const currentUrn = activeThingUrnRef.current;
        if (currentUrn) {
          highlightMarker(currentUrn, { center: false });
        }
      } catch (e) {
        log.warn("地图节点获取失败", e);
        const message = "地图节点加载失败，请稍后重试。";
        setErrorMessage(message);
        setBusinessError(message);
      }
    }
  };

  // 仅更新上一个激活的 Marker → 普通、新目标 Marker → 激活（O(1) 而非 O(n)）
  const highlightMarker = (targetUrn: string, opts?: { center?: boolean; zoom?: number }) => {
    const BMapGL = (window as any).BMapGL;
    if (!BMapGL) return;

    const prevUrn = prevActiveUrnRef.current;

    // 还原上一个激活的 Marker（如果存在且不同于当前目标）
    if (prevUrn && prevUrn !== targetUrn && markersRef.current[prevUrn]) {
      try {
        const prevMarker = markersRef.current[prevUrn];
        prevMarker.setContent(NORMAL_MARKER_HTML);
        prevMarker.setOffset(new BMapGL.Size(-12, -12));
        prevMarker.setZIndex(0);
      } catch (err) {
        log.warn("reset previous marker failed", err);
      }
    }

    // 激活新的目标 Marker
    let targetMarkerLayer: any = null;
    if (markersRef.current[targetUrn]) {
      try {
        const marker = markersRef.current[targetUrn];
        marker.setContent(ACTIVE_MARKER_HTML);
        marker.setOffset(new BMapGL.Size(-16, -16));
        marker.setZIndex(999);
        targetMarkerLayer = marker;
      } catch (err) {
        log.warn("activate target marker failed", err);
      }
    }

    prevActiveUrnRef.current = targetUrn;

    // 居中飞行（仅在明确请求时，如外部选中物节点）
    const shouldCenter = !!opts?.center;
    const targetZoom = typeof opts?.zoom === "number" ? opts.zoom : 15;

    if (targetMarkerLayer && mapInstance.current && shouldCenter) {
      const pos = targetMarkerLayer.getPosition();
      const currentZoom =
        typeof mapInstance.current.getZoom === "function"
          ? mapInstance.current.getZoom()
          : targetZoom;

      try {
        if (currentZoom !== targetZoom) {
          // 缩放需要改变 → centerAndZoom 原子操作，避免 panTo 被后续 setZoom 中断
          mapInstance.current.centerAndZoom(pos, targetZoom);
        } else if (typeof mapInstance.current.panTo === "function") {
          // 缩放已正确 → 平滑平移
          mapInstance.current.panTo(pos);
        } else {
          mapInstance.current.centerAndZoom(pos, targetZoom);
        }
      } catch (err) {
        log.warn("panTo / centerAndZoom failed", err);
      }
      // 不再手动调用 fetchAndRenderMarkers —— 飞行结束后的 dragend 事件会自然触发
    }
  };

  useEffect(() => {
    window.initBaiduMap = () => {
      const BMapGL = (window as any).BMapGL;
      if (!BMapGL || !mapContainer.current) return;

      if (mapInstance.current) {
        mapInstance.current.destroy();
      }

      mapInstance.current = new BMapGL.Map(mapContainer.current);

      // 初始中心点设为高新区
      const point = new BMapGL.Point(106.6302, 26.6474);
      mapInstance.current.centerAndZoom(point, 13);
      mapInstance.current.enableScrollWheelZoom(true);

      // 添加控件
      mapInstance.current.addControl(new BMapGL.ScaleControl());
      mapInstance.current.addControl(new BMapGL.ZoomControl());

      // 绑定视野变化事件
      mapInstance.current.addEventListener('dragend', fetchAndRenderMarkers);
      mapInstance.current.addEventListener('zoomend', fetchAndRenderMarkers);
      // tilesloaded 很容易频繁触发引起风暴请求风暴，因此只绑定明确的用户交互行为
      
      // 初始加载时主动拉取一次周围数据
      setTimeout(fetchAndRenderMarkers, 500);
    };

    // 检查是否已经存在该脚本
    if (document.getElementById("baidu-map-script")) {
      if ((window as any).BMapGL) {
         window.initBaiduMap();
      }
      return;
    }

    const ak = import.meta.env.VITE_BAIDU_MAP_AK || "";
    if (!ak) {
      log.error("[BaiduMap] 缺少 VITE_BAIDU_MAP_AK 环境变量，百度地图无法加载");
      return;
    }
    const script = document.createElement("script");
    script.id = "baidu-map-script";
    script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${ak}&callback=initBaiduMap&s=1`;
    script.async = true;
    document.head.appendChild(script);

    return () => {
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }

      if (mapInstance.current) {
        try { mapInstance.current.destroy(); } catch (e) { log.warn("destroy map failed", e); }
        mapInstance.current = null;
      }
    };
  }, []);

  // 监听外部选中物节点变化（树视图 / 搜索）
  useEffect(() => {
    if (!activeThingUrn || !mapInstance.current) return;

    // 若目标 Marker 已在当前视野中 → 高亮 + 飞行
    if (markersRef.current[activeThingUrn]) {
      highlightMarker(activeThingUrn, { center: true });
      return;
    }

    // Marker 不在当前视野 → 通过 TD 接口获取坐标后飞行
    fetchThingTd(activeThingUrn)
      .then((td) => {
        const geo = td?.["platform:geo"];
        if (geo && typeof geo["platform:latitude"] === "number" && mapInstance.current) {
          const BMapGL = (window as any).BMapGL;
          if (!BMapGL) return;
          const point = new BMapGL.Point(geo["platform:longitude"], geo["platform:latitude"]);
          mapInstance.current.centerAndZoom(point, 15);
          // centerAndZoom 不触发 dragend，需手动调度视野数据加载
          setTimeout(() => fetchAndRenderMarkers(), 500);
        }
      })
      .catch((e) => {
        log.warn("fetch target TD for geo failed", e);
      });
  }, [activeThingUrn]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className="w-full h-full overflow-hidden z-0!"
      >
      </div>
      {errorMessage && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-lg border border-destructive/20 backdrop-blur-sm shadow-lg">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Hover Card — 绝对定位于外层 relative 容器内，坐标来自 pointToPixel */}
      {hoverState &&
        hoverPosition &&
        hoverState.phase !== "idle" &&
        hoverState.phase !== "debouncing" && (
          <HoverCard
            phase={hoverState.phase}
            markerTitle={hoverState.markerTitle}
            address={hoverState.td?.["platform:address"]}
            properties={hoverState.properties}
            screenPosition={hoverPosition}
            onMouseEnter={handleCardEnter}
            onMouseLeave={handleCardLeave}
          />
        )}

      {/* BBox 内无物为正常现象，不阻塞地图交互 */}
    </div>
  );
}
