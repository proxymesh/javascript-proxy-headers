export interface ProxyNeedleOptions {
  proxy: string;
  proxyHeaders?: Record<string, string>;
  onProxyConnect?: (headers: Map<string, string>) => void;
  needleOptions?: Record<string, unknown>;
}

export function proxyNeedleGet(url: string, options: ProxyNeedleOptions): Promise<unknown>;

export interface CreateProxyNeedleOptions {
  proxy: string;
  proxyHeaders?: Record<string, string>;
  onProxyConnect?: (headers: Map<string, string>) => void;
  needleOptions?: Record<string, unknown>;
}

export interface ProxyNeedleClient {
  proxyAgent: import('./index.js').ProxyHeadersAgent;
  get(url: string, opts?: Record<string, unknown>): Promise<unknown>;
}

export function createProxyNeedle(options: CreateProxyNeedleOptions): ProxyNeedleClient;
