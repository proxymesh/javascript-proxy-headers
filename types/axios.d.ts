import type { AxiosInstance, AxiosResponse } from "axios";
import type { ProxyHeadersAgent } from "./index";

export interface CreateProxyAxiosOptions {
  /** Proxy URL */
  proxy: string;
  /** Headers to send to the proxy */
  proxyHeaders?: Record<string, string>;
  /** Callback when CONNECT completes */
  onProxyConnect?: (headers: Map<string, string>) => void;
  /** Additional axios instance options */
  axiosOptions?: object;
}

export interface ProxyAxiosInstance extends AxiosInstance {
  proxyAgent: ProxyHeadersAgent;
}

export function createProxyAxios(
  options: CreateProxyAxiosOptions,
): Promise<ProxyAxiosInstance>;

export function get(
  url: string,
  options: CreateProxyAxiosOptions & { config?: object },
): Promise<AxiosResponse>;

export function post(
  url: string,
  data: any,
  options: CreateProxyAxiosOptions & { config?: object },
): Promise<AxiosResponse>;

