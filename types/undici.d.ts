export interface UndiciRequestOptions {
  /** Proxy URL (required) */
  proxy: string;
  /** Headers to send to the proxy */
  proxyHeaders?: Record<string, string>;
  /** HTTP method */
  method?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: any;
}

export interface UndiciResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: {
    text(): Promise<string>;
    json(): Promise<any>;
    arrayBuffer(): Promise<ArrayBuffer>;
  };
  /** Headers from proxy CONNECT response */
  proxyHeaders: Map<string, string>;
}

export function request(
  url: string | URL,
  options: UndiciRequestOptions,
): Promise<UndiciResponse>;

export function get(
  url: string | URL,
  options: Omit<UndiciRequestOptions, "method">,
): Promise<UndiciResponse>;

export function post(
  url: string | URL,
  options: Omit<UndiciRequestOptions, "method">,
): Promise<UndiciResponse>;

export { ConnectError } from "./index";

