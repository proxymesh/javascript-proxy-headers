export interface ProxyFetchOptions extends RequestInit {
  /** Proxy URL (required) */
  proxy: string;
  /** Headers to send to the proxy */
  proxyHeaders?: Record<string, string>;
  /** Callback when CONNECT completes */
  onProxyConnect?: (headers: Map<string, string>) => void;
}

export interface ProxyResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  url: string;
  redirected: boolean;
  body: ReadableStream<Uint8Array> | null;
  bodyUsed: boolean;

  /** Headers from proxy CONNECT response */
  proxyHeaders: Map<string, string>;

  text(): Promise<string>;
  json(): Promise<any>;
  blob(): Promise<Blob>;
  arrayBuffer(): Promise<ArrayBuffer>;
  formData(): Promise<FormData>;
  clone(): ProxyResponse;
}

export function proxyFetch(
  url: string | URL,
  options: ProxyFetchOptions,
): Promise<ProxyResponse>;

export interface CreateProxyFetchOptions {
  /** Proxy URL */
  proxy: string;
  /** Default headers to send to proxy */
  proxyHeaders?: Record<string, string>;
  /** Callback when CONNECT completes */
  onProxyConnect?: (headers: Map<string, string>) => void;
}

export function createProxyFetch(
  options: CreateProxyFetchOptions,
): (
  url: string | URL,
  fetchOptions?: RequestInit & { proxyHeaders?: Record<string, string> },
) => Promise<ProxyResponse>;

