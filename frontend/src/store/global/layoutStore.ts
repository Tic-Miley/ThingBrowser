// 用户界面个性化设置，包括各侧边栏、地图是否显示，地图组件位置等

import type { StateCreator } from "zustand";

type DetailsPosition = "bottom" | "right";

export interface LayoutSlice {
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  showMap: boolean;
  setShowMap: (show: boolean) => void;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
  detailsPosition: DetailsPosition;
  setDetailsPosition: (position: DetailsPosition) => void;
}

export const createLayoutSlice: StateCreator<
  LayoutSlice,
  [],
  [],
  LayoutSlice
> = (set) => ({
  showSidebar: true,
  setShowSidebar: (show) => set({ showSidebar: show }),
  showMap: true,
  setShowMap: (show) => set({ showMap: show }),
  showDetails: true,
  setShowDetails: (show) => set({ showDetails: show }),
  detailsPosition: "bottom",
  setDetailsPosition: (position) => set({ detailsPosition: position }),
});
