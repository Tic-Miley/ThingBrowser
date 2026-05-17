import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from "axios";
import { useGlobalStore } from "@/store/useGlobalStore";
import { createLogger } from "@/services/logger";

const log = createLogger("HTTP");

// 判定当前环境切换基础 URL
const isDev = import.meta.env.DEV;
const baseURL = isDev ? "http://localhost:3000/api/v1" : "https://api.iotlab.sjtu.edu.cn/v1";

export function buildFullUrl(path: string, protocol: "http" | "ws" = "http") {
  if (path.startsWith("http") || path.startsWith("ws")) return path;
  const base = protocol === "ws" ? baseURL.replace(/^http/, "ws") : baseURL;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

const httpClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ====================
// 请求拦截器
// ====================
httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 1. 挂载 Token（从 Zustand AuthSlice 读取）
    const token = useGlobalStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. 挂载时间戳用于计算网络耗时
    (config as any).metadata = { startTime: performance.now() };

    // 3. 提取请求载荷
    const payloadStr = [
      Object.keys(config.params || {}).length
        ? `Query: ${JSON.stringify(config.params)}`
        : "",
      Object.keys(config.data || {}).length
        ? `Body: ${JSON.stringify(config.data)}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    // 4. 日志 - 发送
    log.info(`${config.method?.toUpperCase()} ${config.url}`, payloadStr || undefined);

    return config;
  },
  (error: AxiosError) => {
    log.error("请求拦截器错误", error);
    return Promise.reject(error);
  }
);

// ====================
// 响应拦截器
// ====================
httpClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 计算耗时
    const startTime = (response.config as any).metadata?.startTime || performance.now();
    const duration = Math.round(performance.now() - startTime);

    // 高精度日志打印 - 接收成功
    let resDataStr = JSON.stringify(response.data) || "";
    if (resDataStr.length > 1000) {
      resDataStr = resDataStr.substring(0, 1000) + "... (已截断)";
    }
    log.info(`${response.status} OK, ${duration}ms [${response.config.url}]`, resDataStr);

    return response;
  },
  (error: AxiosError) => {
    // 失败时的计算与拦截
    const startTime = (error.config as any)?.metadata?.startTime || performance.now();
    const duration = Math.round(performance.now() - startTime);
    const status = error.response?.status || "Network Error";

    // 高精度日志打印 - 接收失败
    log.error(`${status}, ${duration}ms [${error.config?.url}]`, error.response?.data || error.message);

    // 全局错误拦截，例如 401 身份过期
    if (status === 401) {
      // 清除过期 token
      useGlobalStore.getState().setToken(null);
      log.warn("检测到 401 未授权，已清除本地 token 状态。");
      // TODO: 未来接入真实登录页后可在此处触发重定向
      // window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default httpClient;
