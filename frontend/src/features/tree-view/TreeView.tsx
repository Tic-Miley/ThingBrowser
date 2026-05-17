import { useEffect } from "react";
import { TreeNode } from "./TreeNode";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchRootNodes } from "@/services/http/topologyService";
import { useGlobalStore } from "@/store/useGlobalStore";

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : "未知错误";
}

export function TreeView() {
  const setBusinessError = useGlobalStore((state) => state.setBusinessError);

  const {
    data: nodes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["topology", "root"],
    queryFn: () => fetchRootNodes(),
    staleTime: 30000,
  });

  useEffect(() => {
    if (error) {
      setBusinessError(formatError(error));
    }
  }, [error, setBusinessError]);

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        加载拓扑树失败: {formatError(error)}
      </div>
    );
  }

  // 骨架屏加载状态
  if (isLoading && nodes.length === 0) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2 ml-4" />
        <Skeleton className="h-5 w-2/3 ml-4" />
        <Skeleton className="h-5 w-4/5 ml-8" />
        <Skeleton className="h-5 w-4/5 ml-8" />
      </div>
    );
  }

  return (
    <div className="py-2 px-2">
      {nodes.map((node) => (
        <TreeNode key={node.id} node={node} />
      ))}
    </div>
  );
}
