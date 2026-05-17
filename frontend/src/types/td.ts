/**
 * 简化版的 W3C Web of Things (WoT) Thing Description 类型声明。
 * 基于项目的平台扩展 (platform:)。
 */

export interface Form {
  href: string;
  op: string | string[];
  "platform:methodName"?: string;
  contentType: string;
  security?: string[];
}

export interface PropertyAffordance {
  title?: string;
  "@type"?: string | string[];
  description?: string;
  type?: string;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  readOnly?: boolean;
  observable?: boolean;
  forms: Form[];
  
  // 卡片注册表集成：指定使用的 UI 卡片样式
  uiType?: string;
  
  // 平台扩展：标记数据密级
  "platform:securityLevel"?: "L1" | "L2" | "L3" | "L4";
}

export interface ActionAffordance {
  title?: string;
  description?: string;
  input?: {
    type: string;
    enum?: string[];
  };
  forms: Form[];
  
  // 卡片注册表集成：指定使用的 UI 卡片样式
  uiType?: string;
  
  "platform:securityLevel"?: "L1" | "L2" | "L3" | "L4";
}

export interface EventAffordance {
  title?: string;
  description?: string;
  type?: string;
  observable?: boolean;
  forms: Form[];

  // 卡片注册表集成：指定使用的 UI 卡片样式
  uiType?: string;

  "platform:securityLevel"?: "L1" | "L2" | "L3" | "L4";
}

export interface ThingDescription {
  "@context": any[];
  id: string; // 常常是 URN 形式
  title: string;
  "@type"?: string | string[];
  description?: string;
  
  "platform:address"?: string;
  "platform:geo"?: {
    "platform:latitude": number;
    "platform:longitude": number;
  };
  
  securityDefinitions?: Record<string, any>;
  security?: string | string[];

  properties?: Record<string, PropertyAffordance>;
  actions?: Record<string, ActionAffordance>;
  events?: Record<string, EventAffordance>;
}
