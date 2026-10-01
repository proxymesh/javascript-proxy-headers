import type { AxiosInstance, AxiosResponse } from "axios";
import type { ProxyHeadersAgent } from "./index";

export interface CreateProxyAxiosOptions {
  /** Proxy URL */
  proxy: string;
  /** Headers to send to the proxy */
  proxyHeaders?: Record<string, string>;
  /** Callback when CONNECT completes */
  onProxyConnect?: (headers: Map<string, string>) => void;
  /** TLS options for an https:// proxy */
  proxyTlsOptions?: object;
  /** Additional axios instance options */
  axiosOptions?: object;
}

export interface AxiosResponseWithProxyHeaders<T = any> extends AxiosResponse<T> {
  /** CONNECT response headers for this request (not merged into origin headers) */
  proxyHeaders: Map<string, string>;
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

