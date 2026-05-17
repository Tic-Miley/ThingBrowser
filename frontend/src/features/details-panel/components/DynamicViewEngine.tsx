// 动态视图引擎（Dynamic View Engine）
// DynamicViewEngine.tsx

// 通过阅读物功能表（TD）片段，通过数据类型等信息智能推断所使用的卡片样式

import { memo } from "react";
import { Activity, Bell, FileSpreadsheet, Wrench } from "lucide-react";
import type {
  ThingDescription,
  PropertyAffordance,
  ActionAffordance,
  EventAffordance,
} from "@/types/td";
import { COMPONENT_REGISTRY, getCardConfig } from "@/constants/DataCardTemplates";
import type { RegistryRenderContext } from "@/constants/DataCardTemplates";
import { buildThingTdLowCodeHtmlDataUrl } from "@/constants/TDMapper";
import { CardWrapper } from "@/features/details-panel/components/CardWrapper";

// ==========================================
// 引擎调度层
// TODO: 当前通过 TD 中的 uiType 字段硬匹配卡片类型。后续可演进为：
//   1. 规则引擎：根据 type/observable/readOnly 等 TD 语义自动推断卡片
//   2. 智能调度：结合用户偏好、屏幕尺寸、数据密度动态选择卡片样式
// ==========================================

type SectionDef = {
  record: Record<string, PropertyAffordance | ActionAffordance | EventAffordance>;
  defaultUiType: string;
  fallbackCardKey: string;
  contextKey: "property" | "action" | "event";
  icon: React.ReactNode;
  gridCols?: string;
};

function renderCardSection(td: ThingDescription, section: SectionDef) {
  const entries = Object.entries(section.record);
  if (entries.length === 0) return null;

  return (
    <section className="space-y-4 mt-4">
      <div className="flex items-center gap-2">{section.icon}</div>
      <div
        className={`grid ${section.gridCols || "grid-cols-2 md:grid-cols-3 gap-4"}`}
      >
        {entries.map(([key, def]) => {
          const uiType =
            (def as any).uiType || section.defaultUiType;
          const cardConfig =
            getCardConfig(uiType) ||
            COMPONENT_REGISTRY[section.fallbackCardKey] ||
            COMPONENT_REGISTRY.UnsupportedCard;
          const context: RegistryRenderContext = {
            thing: td,
            key,
            [section.contextKey]: def,
          } as RegistryRenderContext;
          const cardProps = cardConfig.resolveProps(context);

          return (
            <CardWrapper
              key={key}
              cardConfig={cardConfig}
              cardProps={cardProps}
            />
          );
        })}
      </div>
    </section>
  );
}

export const DynamicViewEngine = memo(function DynamicViewEngine({
  td,
}: {
  td: ThingDescription;
}) {
  const tdLowCodeUrl = buildThingTdLowCodeHtmlDataUrl(td);

  return (
    <div className="w-full flex flex-col gap-8">
      {renderCardSection(td, {
        record: td.properties || {},
        defaultUiType: "UnsupportedCard",
        fallbackCardKey: "UnsupportedCard",
        contextKey: "property",
        icon: (
          <>
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">数据状态</h2>
          </>
        ),
        gridCols: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4",
      })}

      {renderCardSection(td, {
        record: td.actions || {},
        defaultUiType: "ActionButtonCard",
        fallbackCardKey: "ActionButtonCard",
        contextKey: "action",
        icon: (
          <>
            <Wrench className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              控制面板
            </h2>
          </>
        ),
      })}

      {renderCardSection(td, {
        record: td.events || {},
        defaultUiType: "UnsupportedCard",
        fallbackCardKey: "UnsupportedCard",
        contextKey: "event",
        icon: (
          <>
            <Bell className="w-5 h-5 text-sky-600" />
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              通知中心
            </h2>
          </>
        ),
      })}

      {/* 物功能表：不是 TD property，而是由整个 TD 合成生成的 HTML 文档卡片。
          因此绕过 resolveProps，直接传递构造好的 title/url。 */}
      <section className="space-y-4 mt-4">
        <div className="flex items-center gap-2 text-emerald-600">
          <FileSpreadsheet className="w-5 h-5" />
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            物功能表
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <COMPONENT_REGISTRY.HtmlDocumentCard.component
            title="物功能表 (中文表格)"
            url={tdLowCodeUrl}
          />
        </div>
      </section>
    </div>
  );
});