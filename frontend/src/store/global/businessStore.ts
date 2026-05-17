// 用于浏览树（tree-view）

import type { StateCreator } from "zustand";
import type { TopologyNode } from "@/types/topology";

export interface BusinessSlice {
  treeChildrenById: Record<string, TopologyNode[]>;
  setTreeChildrenById: (id: string, children: TopologyNode[]) => void;
  businessError: string | null;
  setBusinessError: (error: string | null) => void;
}

export const createBusinessSlice: StateCreator<
  BusinessSlice,
  [],
  [],
  BusinessSlice
> = (set) => ({
  treeChildrenById: {},
  setTreeChildrenById: (id, children) =>
    set((state) => ({
      treeChildrenById: {
        ...state.treeChildrenById,
        [id]: children,
      },
    })),
  businessError: null,
  setBusinessError: (error) => set({ businessError: error }),
});
