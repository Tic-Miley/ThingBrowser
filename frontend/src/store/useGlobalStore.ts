import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  NavigationSlice,
  LayoutSlice,
  AuthSlice,
  BusinessSlice,
} from "@/store/global";
import {
  createNavigationSlice,
  createLayoutSlice,
  createAuthSlice,
  createBusinessSlice,
} from "@/store/global";

type GlobalState = NavigationSlice & LayoutSlice & AuthSlice & BusinessSlice;

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set, get, api) => ({
      ...createNavigationSlice(set, get, api),
      ...createLayoutSlice(set, get, api),
      ...createAuthSlice(set, get, api),
      ...createBusinessSlice(set, get, api),
    }),
    {
      name: 'iot-dashboard-storage',
      // 只持久化布局和极少状态，避免持久化选中节点导致刷新卡在上个状态
      partialize: (state) => ({
        showSidebar: state.showSidebar,
        showMap: state.showMap,
        showDetails: state.showDetails,
        detailsPosition: state.detailsPosition,
        user: state.user,
        token: state.token,
      }),
    }
  )
);
