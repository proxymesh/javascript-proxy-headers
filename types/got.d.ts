import type { Got, Response as GotResponse } from "got";
import type { ProxyHeadersAgent } from "./index";

export interface CreateProxyGotOptions {
  /** Proxy URL */
  proxy: string;
  /** Headers to send to the proxy */
  proxyHeaders?: Record<string, string>;
  /** Callback when CONNECT completes */
  onProxyConnect?: (headers: Map<string, string>) => void;
  /** Additional got instance options */
  gotOptions?: object;
}

export interface ProxyGotInstance extends Got {
  proxyAgent: ProxyHeadersAgent;
}

export function createProxyGot(
  options: CreateProxyGotOptions,
): Promise<ProxyGotInstance>;

export function proxyGet(
  url: string,
  options: CreateProxyGotOptions & { gotOptions?: object },
): Promise<GotResponse>;

export function proxyPost(
  url: string,
  options: CreateProxyGotOptions & { gotOptions?: object },
): Promise<GotResponse>;

