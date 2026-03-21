import type { ProxyHeadersAgent } from './index.js';
import type { ProxyResponse } from './node-fetch.js';

export interface CreateProxyMakeFetchHappenOptions {
  proxy: string;
  proxyHeaders?: Record<string, string>;
  onProxyConnect?: (headers: Map<string, string>) => void;
  [key: string]: unknown;
}

export interface ProxyMakeFetchHappen {
  (input: RequestInfo | URL, init?: RequestInit): Promise<ProxyResponse>;
  defaults(
    defaultUrl?: string | Request | URL,
    defaultOptions?: RequestInit,
  ): ProxyMakeFetchHappen;
  proxyAgent: ProxyHeadersAgent;
}

export function createProxyMakeFetchHappen(
  options: CreateProxyMakeFetchHappenOptions,
): ProxyMakeFetchHappen;
