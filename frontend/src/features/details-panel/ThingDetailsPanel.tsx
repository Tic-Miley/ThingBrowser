import { useGlobalStore } from "@/store/useGlobalStore";
import { DynamicViewEngine } from "@/features/details-panel/components/DynamicViewEngine";
import { useQuery } from "@tanstack/react-query";
import type { ThingDescription } from "@/types/td";
import { Skeleton } from "@/components/ui/skeleton";
import { Box } from "lucide-react";
import { fetchThingTd } from "@/services/http/thingService";
import { ThingMeta } from "@/features/details-panel/components/ThingMeta";

export function ThingDetailsPanel() {
  const activeThingUrn = useGlobalStore((state) => state.activeThingUrn);

  const { data: td, isLoading, error } = useQuery<ThingDescription>({
    queryKey: ['thing', activeThingUrn],
    queryFn: async () => {
      if (!activeThingUrn) throw new Error("No urn");
      return fetchThingTd(activeThingUrn);
    },
    enabled: !!activeThingUrn
  });

  // View States
  if (!activeThingUrn) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/10 text-muted-foreground p-6">
        <p>选择一个物节点并查看其详细信息</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 w-full max-w-4xl mx-auto">
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !td || !td.title) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-muted/10 p-6">
        <Box className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">未关联具体物模型</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center break-all">
          该节点 URN (<code className="bg-muted px-1 py-0.5 rounded text-xs">{activeThingUrn}</code>) 尚未注册完整的 W3C TD 描述或为行政占位节点。
        </p>
      </div>
    );
  }

  // Actual TD Rendering
  return (
    <div className="flex flex-col gap-8 p-6 w-full overflow-y-auto mx-auto pb-20">
      <ThingMeta td={td} />

      <hr className="border-border/60" />

      {/* 2. Object View Replacement via Render Engine */}
      <DynamicViewEngine td={td} />

    </div>
  );
}