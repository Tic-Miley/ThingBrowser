// 暂时的用户权限与数据密级设计

export type PermissionLevel = "L1" | "L2" | "L3" | "L4";

export type Role = "consumer" | "admin" | "developer";

export interface User {
  id: string;
  name: string;
  role: Role;
  permissions: PermissionLevel[];
}

export const MOCK_USERS: Record<Role, User & { token: string }> = {
  consumer: {
    id: "u1",
    name: "普通用户",
    role: "consumer",
    permissions: ["L1"], // 仅 L1 公开数据
    token: "mock_token_consumer",
  },
  admin: {
    id: "u2",
    name: "授权管理员",
    role: "admin",
    permissions: ["L1", "L2"], // L1 + L2 授权数据
    token: "mock_token_admin",
  },
  developer: {
    id: "u3",
    name: "开发者",
    role: "developer",
    permissions: ["L1", "L2", "L3"], // 解锁 API/原始文档等 L3 级别
    token: "mock_token_developer",
  },
};