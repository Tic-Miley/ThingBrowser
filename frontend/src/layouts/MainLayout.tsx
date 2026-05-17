import { Outlet } from "react-router-dom"
import { TopNavbar } from "@/layouts/TopNavbar"
import { Sidebar } from "@/layouts/Sidebar"
import { useGlobalStore } from "@/store/useGlobalStore"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

/**
 * 主应用布局，确立顶部导航与可拖动的左右面板比例结构。
 * 利用 Shadcn UI 的 Resizable 组件控制多区域自适应。
 */
export function MainLayout() {
  const showSidebar = useGlobalStore((state) => state.showSidebar)
  const showMap = useGlobalStore((state) => state.showMap)
  const showDetails = useGlobalStore((state) => state.showDetails)
  const businessError = useGlobalStore((state) => state.businessError)
  const setBusinessError = useGlobalStore((state) => state.setBusinessError)
  const hasMainContent = showMap || showDetails

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      {/* 顶部固定导航区 */}
      <TopNavbar />

      {businessError && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <span>{businessError}</span>
          <button
            type="button"
            className="text-destructive/80 hover:text-destructive text-xs"
            onClick={() => setBusinessError(null)}
          >
            关闭
          </button>
        </div>
      )}

      {/* 动态工作区 */}
      <div className="flex-1 overflow-hidden">
        {!showSidebar && !hasMainContent ? (
          <div className="flex h-full w-full items-center justify-center flex-col text-muted-foreground animate-in fade-in duration-500 delay-150 fill-mode-both">
            <p>所有视图面板已被隐藏</p>
            <p className="text-sm mt-2">请通过上方“视图”菜单重新启用</p>
          </div>
        ) : (
          <ResizablePanelGroup
            orientation="horizontal"
            className="h-full items-stretch"
          >
            {/* 左侧边栏 - 行政树状浏览面板 */}
            {showSidebar && (
              <>
                <ResizablePanel 
                  defaultSize={hasMainContent ? "24%" : "100%"} 
                  minSize={hasMainContent ? "5%" : "100%"} 
                  maxSize={hasMainContent ? "80%" : "100%"}
                  className="hidden md:block transition-all"
                >
                  <Sidebar />
                </ResizablePanel>

                {/* 拖拽控制柄 */}
                {hasMainContent && (
                  <ResizableHandle withHandle className="hidden md:flex bg-border/50 hover:bg-primary/20 transition-colors" />
                )}
              </>
            )}

            {/* 右侧边栏 - 主要的工作视口 (包含地图、控制面板等) */}
            {hasMainContent && (
              <ResizablePanel defaultSize={showSidebar ? "76%" : "100%"}>
                {/* React Router 页面组件占位符 */}
                <main className="h-full w-full relative">
                  <Outlet />
                </main>
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  )
}
