// 存储用户的权限状态，用于数据安全和权限管理

import type { StateCreator } from "zustand";
import { MOCK_USERS, type User, type Role } from "@/types/auth";

export interface AuthSlice {
  user: User;
  token: string | null;
  setToken: (token: string | null) => void;
  setUserMode: (role: Role) => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (
  set
) => ({
  user: MOCK_USERS.consumer,
  token: MOCK_USERS.consumer.token,
  setToken: (token) => set({ token }),
  setUserMode: (role) =>
    set({ user: MOCK_USERS[role], token: MOCK_USERS[role].token }),
});
