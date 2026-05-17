import { useEffect, useRef } from "react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ThingDetailsPanel } from "@/features/details-panel/ThingDetailsPanel"
import { MapView } from "@/features/map-view/MapView"
import { useGlobalStore } from "@/store/useGlobalStore"

export function Home() {
  const showMap = useGlobalStore(s => s.showMap)
  const showDetails = useGlobalStore(s => s.showDetails)
  const setShowDetails = useGlobalStore(s => s.setShowDetails)
  const detailsPosition = useGlobalStore(s => s.detailsPosition)
  
  const activeThingUrn = useGlobalStore(s => s.activeThingUrn)
  const prevUrnRef = useRef(activeThingUrn);

  // 自动展开逻辑：仅当 activeThingUrn 发生非空变化时，才自动唤醒面板
  useEffect(() => {
    if (activeThingUrn && activeThingUrn !== prevUrnRef.current) {
      if (!showDetails) {
        setShowDetails(true);
      }
    }
    // 无论是否触发唤醒，更新 ref 的缓存值
    prevUrnRef.current = activeThingUrn;
  }, [activeThingUrn, showDetails, setShowDetails]);

  // 如果地图和详情都没有，则组件无需渲染任何内容，因为 MainLayout 内已做了隐藏和接管
  if (!showMap && !showDetails) {
    return null;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ResizablePanelGroup
        orientation={detailsPosition === "right" ? "horizontal" : "vertical"}
        className="h-full w-full items-stretch"
      >
        {showMap && (
          <ResizablePanel 
            defaultSize={showDetails ? "70%" : "100%"} 
            minSize="10%" 
            className="w-full h-full relative isolate"
          >
            <MapView />
          </ResizablePanel>
        )}

        {showMap && showDetails && (
          <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/20 transition-colors" />
        )}

        {showDetails && (
          <ResizablePanel 
            defaultSize={showMap ? "30%" : "100%"} 
            minSize="10%" 
            className="flex flex-col p-6 bg-muted/10 relative isolate"
          >
            <div className="flex flex-wrap gap-4 overflow-y-auto pb-4 w-full h-full">
              <ThingDetailsPanel />
            </div>
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
