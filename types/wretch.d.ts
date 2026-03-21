import type { Wretch } from 'wretch';

export interface CreateProxyWretchOptions {
  proxy: string;
  proxyHeaders?: Record<string, string>;
  onProxyConnect?: (headers: Map<string, string>) => void;
}

export function createProxyWretch(options: CreateProxyWretchOptions): Promise<Wretch>;
