export interface TopologyNode {
  id: string;          // 唯一标识符，如 "gy"、"gx"
  title: string;       // 显示名称，如 "贵州省"
  type: "region" | "thing"; // region 为行政区域，thing 为具体的物体
  children?: TopologyNode[]; // 子节点数组（前端逐步加载）
  thingUrn?: string;   // 物体 URN，仅对 type="thing" 有值，如 "urn:platform:thing:parking-lot"
  // 优化移除的字段：
  // - hasChildren: 从 type 和 children[] 数组推断（type="region"且返回非空数组）
  // - path: 由前端导航栈维护，无需每个节点存储完整路径
}
