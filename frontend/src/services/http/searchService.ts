import httpClient from "@/services/http/httpClient";

export interface SearchItem {
  id: string;
  title: string;
  type: "region" | "thing";
  path: string;
  urn?: string; // 对齐后端实际返回字段名
}

// ==========================================
// 搜索结果缓存（相同查询 5 秒内复用）
// ==========================================
const searchCache = new Map<string, { data: SearchItem[]; ts: number }>();
const SEARCH_CACHE_TTL = 5000;

export async function searchThings(query: string): Promise<SearchItem[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  // 命中缓存直接返回
  const cached = searchCache.get(normalized);
  if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL) {
    return cached.data;
  }

  const res = await httpClient.get(`/things/search?q=${encodeURIComponent(normalized)}`, { timeout: 8000 });
  const items: SearchItem[] = Array.isArray(res.data) ? res.data : [];

  // 缓存结果并清理过期条目
  const now = Date.now();
  for (const [k, v] of searchCache) {
    if (now - v.ts > SEARCH_CACHE_TTL * 2) searchCache.delete(k);
  }
  searchCache.set(normalized, { data: items, ts: now });

  return items;
}
