import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderTree } from "lucide-react";
import { TreeView } from "@/features/tree-view";

/**
 * 侧边栏基础组件，承载行政树状试图的容器区域。
 */
export function Sidebar() {
  return (
    <div className="flex h-full w-full flex-col bg-muted/20 border-r border-border">
      {/* 侧边栏标题/筛选工具区 */}
      <div className="flex h-12 shrink-0 items-center border-b px-4 font-medium text-sm text-muted-foreground">
        <FolderTree className="h-4 w-4 mr-2" />
        物节点树
      </div>

      {/* 滚动区域，容纳可能非常长的行政树状列表 */}
      <ScrollArea className="flex-1">
        <TreeView />
      </ScrollArea>
    </div>
  );
}
