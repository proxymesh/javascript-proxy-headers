export interface ProxyNeedleOptions {
  proxy: string;
  proxyHeaders?: Record<string, string>;
  onProxyConnect?: (headers: Map<string, string>) => void;
  proxyTlsOptions?: object;
  needleOptions?: Record<string, unknown>;
}

export interface NeedleResponseWithProxyHeaders {
  proxyHeaders: Map<string, string>;
  proxyAgent: import('./index.js').ProxyHeadersAgent;
  [key: string]: unknown;
}

export function proxyNeedleGet(url: string, options: ProxyNeedleOptions): Promise<NeedleResponseWithProxyHeaders>;

export interface CreateProxyNeedleOptions {
  proxy: string;
  proxyHeaders?: Record<string, string>;
  onProxyConnect?: (headers: Map<string, string>) => void;
  proxyTlsOptions?: object;
  needleOptions?: Record<string, unknown>;
}

export interface ProxyNeedleClient {
  proxyAgent: import('./index.js').ProxyHeadersAgent;
  get(url: string, opts?: Record<string, unknown>): Promise<unknown>;
}

export function createProxyNeedle(options: CreateProxyNeedleOptions): ProxyNeedleClient;
