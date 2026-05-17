import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { ThingDescription } from "@/types/td";
import { typeTranslations } from "@/constants/TypeGlossary";

export function ThingMeta({ td }: { td: ThingDescription }) {
  const types = td["@type"]
    ? Array.isArray(td["@type"])
      ? td["@type"]
      : [td["@type"]]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          {td.title}
        </h1>
        {/* TODO: 当前硬编码为"在线"，仅为 demo 临时占位。
            未来应从 WebSocket 心跳或 TD status 字段获取真实在线/离线状态。 */}
        <Badge
          variant="outline"
          className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 font-mono"
        >
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 animate-pulse" />
          在线
        </Badge>
      </div>

      <p className="text-base text-muted-foreground max-w-3xl leading-relaxed">
        {td.description || "无详细描述"}
      </p>

      <div className="flex flex-wrap gap-2 mt-2">
        {td["platform:address"] && (
          <Badge
            variant="secondary"
            className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
          >
            <MapPin className="w-3 h-3 mr-1" /> {td["platform:address"]}
          </Badge>
        )}
        {types.map((t, i) => (
          <Badge key={i} variant="outline" className="text-xs border-dashed">
            {typeTranslations[t as string] || t}
          </Badge>
        ))}
      </div>
    </div>
  );
}
