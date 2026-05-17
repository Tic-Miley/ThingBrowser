import httpClient from "@/services/http/httpClient";
import type { ThingDescription } from "@/types/td";

export async function fetchThingTd(urn: string): Promise<ThingDescription> {
  const res = await httpClient.get(`/things/${encodeURIComponent(urn)}`);
  return res.data as ThingDescription;
}

export async function fetchThingsInBbox(bbox: string): Promise<any[]> {
  const res = await httpClient.get(`/things/geo?bbox=${bbox}`, { timeout: 20000 });
  return Array.isArray(res.data) ? res.data : [];
}
