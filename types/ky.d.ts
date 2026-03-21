import type { KyInstance, Options as KyOptions } from 'ky';

export interface CreateProxyKyOptions {
  proxy: string;
  proxyHeaders?: Record<string, string>;
  onProxyConnect?: (headers: Map<string, string>) => void;
  kyOptions?: KyOptions;
}

export function createProxyKy(options: CreateProxyKyOptions): Promise<KyInstance>;
