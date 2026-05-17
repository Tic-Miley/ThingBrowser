import { memo, useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Box, Loader2 } from "lucide-react";
import type { TopologyNode } from "@/types/topology";
import { useGlobalStore } from "@/store/useGlobalStore";
import { cn } from "@/lib/utils";
import { fetchChildrenById } from "@/services/http/topologyService";
import { createLogger } from "@/services/logger";

const log = createLogger("TreeView");

interface TreeNodeProps {
  node: TopologyNode;
  level?: number;
}

export const TreeNode = memo(function TreeNode({
  node,
  level = 0,
}: TreeNodeProps) {
  // 从 Zustand 读取缓存的子节点（唯一数据源，不再维护本地镜像）
  const cachedChildren = useGlobalStore((state) =>
    node.id ? state.treeChildrenById[node.id] : undefined
  );
  const setTreeChildrenById = useGlobalStore(
    (state) => state.setTreeChildrenById
  );

  const [isExpanded, setIsExpanded] = useState(
    Boolean(
      (node.children && node.children.length > 0) ||
        (cachedChildren && cachedChildren.length > 0)
    )
  );
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);

  const activeThingUrn = useGlobalStore((s) => s.activeThingUrn);
  const setActiveThingUrn = useGlobalStore((s) => s.setActiveThingUrn);

  const isThing = node.type === "thing";
  const hasChildren = node.type === "region";
  const isActive = isThing && activeThingUrn === node.thingUrn;

  // 当前节点的子节点数据：优先 Zustand 缓存，fallback 到 props 传入的 children
  const children = cachedChildren || node.children || [];
  const hasLoadedChildren = children.length > 0;

  const handleToggle = async () => {
    if (!hasChildren) return;

    if (!isExpanded && !hasLoadedChildren && node.id) {
      setIsLoadingChildren(true);
      try {
        const fetched = await fetchChildrenById(node.id);
        setTreeChildrenById(node.id, fetched);
      } catch (err) {
        log.error("Failed to load children:", err);
      } finally {
        setIsLoadingChildren(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isThing && node.thingUrn) {
      setActiveThingUrn(node.thingUrn);
    } else if (hasChildren) {
      handleToggle();
    }
  };

  const paddingLeft = level * 16 + 8;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center py-1.5 pr-2 rounded-md cursor-pointer transition-colors text-sm",
          isActive
            ? "bg-primary/10 text-primary font-medium shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
            : "hover:bg-accent hover:text-accent-foreground text-foreground/80"
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
      >
        {/* 展开折叠图标 */}
        <div
          className="w-4 h-4 mr-1 flex items-center justify-center shrink-0"
        >
          {hasChildren &&
            (isLoadingChildren ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 opacity-70" />
            ))}
        </div>

        {/* 节点类型图标 */}
        <div className="w-5 h-5 flex items-center justify-center mr-1.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors">
          {!isThing ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4" />
            ) : (
              <Folder className="h-4 w-4" />
            )
          ) : (
            <Box className={cn("h-4 w-4", isActive && "text-primary")} />
          )}
        </div>

        {/* 节点文本 */}
        <span className="truncate flex-1">{node.title}</span>

        {/* 状态指示小圆点 */}
        {/* TODO: 当前通过 node.id.includes 硬编码颜色，仅为 demo 临时占位。
            未来应通过 TD properties 或 WebSocket 获取真实在线/离线/告警状态。 */}
        {isThing && (
          <span
            className="h-2 w-2 rounded-full shrink-0 ml-2"
            style={{
              backgroundColor: node.id.includes("camera")
                ? "#3b82f6"
                : node.id.includes("light")
                  ? "#f59e0b"
                  : "#22c55e",
            }}
          />
        )}
      </div>

      {/* 递归渲染子节点 */}
      {hasChildren && isExpanded && hasLoadedChildren && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
});
