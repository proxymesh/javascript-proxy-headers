import type { Response, SuperAgentRequest } from "superagent";
import type { ConnectError } from "./index";

export interface ProxyPluginOptions {
  /** Proxy URL (required) */
  proxy: string;
  /** Headers to send to the proxy */
  proxyHeaders?: Record<string, string>;
  /** Callback when CONNECT completes */
  onProxyConnect?: (headers: Map<string, string>) => void;
}

export interface ProxyResponse extends Response {
  /** Headers from proxy CONNECT response */
  proxyHeaders?: Map<string, string>;
}

export function proxyPlugin(
  options: ProxyPluginOptions,
): (request: SuperAgentRequest) => SuperAgentRequest;

export interface ProxySuperagentClient {
  get(url: string): SuperAgentRequest;
  post(url: string): SuperAgentRequest;
  put(url: string): SuperAgentRequest;
  delete(url: string): SuperAgentRequest;
  patch(url: string): SuperAgentRequest;
  head(url: string): SuperAgentRequest;
}

export function createProxySuperagent(
  options: ProxyPluginOptions,
): Promise<ProxySuperagentClient>;

export type { ConnectError };

