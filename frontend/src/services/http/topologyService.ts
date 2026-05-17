import httpClient from "@/services/http/httpClient";
import type { TopologyNode } from "@/types/topology";

export async function fetchRootNodes(): Promise<TopologyNode[]> {
  return fetchChildrenById();
}

export async function fetchChildrenById(id?: string): Promise<TopologyNode[]> {
  const url = id ? `/namespace/children?id=${encodeURIComponent(id)}` : "/namespace/children";
  const res = await httpClient.get(url);
  return (res.data?.children ?? []) as TopologyNode[];
}
