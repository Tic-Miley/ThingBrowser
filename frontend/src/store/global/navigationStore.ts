// 跟踪当前选中的物（activeThingUrn），同步各组件展示状态

import type { StateCreator } from "zustand";

export interface NavigationSlice {
  activeThingUrn: string | null;
  setActiveThingUrn: (urn: string | null) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toggleSearchOpen: () => void;
}

export const createNavigationSlice: StateCreator<
  NavigationSlice,
  [],
  [],
  NavigationSlice
> = (set) => ({
  activeThingUrn: null,
  setActiveThingUrn: (urn) => set({ activeThingUrn: urn }),
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  toggleSearchOpen: () => set((state) => ({ searchOpen: !state.searchOpen })),
});
