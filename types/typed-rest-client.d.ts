import type * as ifm from 'typed-rest-client/Interfaces';

export interface CreateProxyRestClientOptions {
  userAgent: string;
  baseUrl?: string;
  handlers?: ifm.IRequestHandler[];
  requestOptions?: ifm.IRequestOptions;
  proxy: string;
  proxyHeaders?: Record<string, string>;
  onProxyConnect?: (headers: Map<string, string>) => void;
}

export function createProxyRestClient(
  options: CreateProxyRestClientOptions,
): import('typed-rest-client/RestClient').RestClient & {
  proxyAgent: import('./index.js').ProxyHeadersAgent;
};
