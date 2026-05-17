/** 全局类型声明补充 */
export {};

declare global {
  interface Window {
    initBaiduMap?: () => void;
    BMapGL?: unknown;
  }
}
