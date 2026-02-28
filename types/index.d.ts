/**
 * JavaScript Proxy Headers - TypeScript Definitions
 */

import { Agent } from 'https';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { Got, Response as GotResponse } from 'got';

// =============================================================================
// Core Types
// =============================================================================

export interface ProxyHeadersAgentOptions {
    /** Headers to send to the proxy during CONNECT */
    proxyHeaders?: Record<string, string>;
    /** Callback when CONNECT completes */
    onProxyConnect?: (headers: Map<string, string>) => void;
    /** Timeout for proxy CONNECT in ms (default: 30000) */
    proxyTimeout?: number;
    /** TLS options for target connection */
    tlsOptions?: object;
}

export class ProxyHeadersAgent extends Agent {
    constructor(proxy: string | URL, options?: ProxyHeadersAgentOptions);
    
    /** Proxy hostname */
    readonly proxyHost: string;
    /** Proxy port */
    readonly proxyPort: number;
    /** Base64-encoded proxy auth */
    readonly proxyAuth: string | null;
    /** Headers to send to proxy */
    readonly proxyHeaders: Record<string, string>;
    /** Headers from last CONNECT response */
    lastProxyHeaders: Map<string, string> | null;
}

export class ConnectError extends Error {
    name: 'ConnectError';
    statusCode: number;
    statusMessage: string;
    proxyHeaders: Map<string, string>;
    
    constructor(
        message: string,
        statusCode: number,
        statusMessage: string,
        headers: Map<string, string>
    );
}

// =============================================================================
// Utility Functions
// =============================================================================

export interface ParsedProxyUrl {
    host: string;
    port: number;
    auth: string | null;
    protocol: string;
}

export interface ParsedTargetUrl {
    host: string;
    port: number;
}

export interface ConnectResponse {
    statusCode: number;
    statusMessage: string;
    headers: Map<string, string>;
    bodyStart: number;
}

export function parseProxyUrl(proxyUrl: string | URL): ParsedProxyUrl;
export function parseTargetUrl(targetUrl: string | URL): ParsedTargetUrl;
export function buildConnectRequest(
    targetHost: string,
    targetPort: number,
    proxyAuth: string | null,
    proxyHeaders?: Record<string, string>
): string;
export function parseConnectResponse(data: Buffer | string): ConnectResponse | null;
export function hasCompleteHeaders(buffer: Buffer): boolean;

// =============================================================================
// Axios Types
// =============================================================================

declare module 'javascript-proxy-headers/axios' {
    export interface CreateProxyAxiosOptions {
        /** Proxy URL */
        proxy: string;
        /** Headers to send to the proxy */
        proxyHeaders?: Record<string, string>;
        /** Callback when CONNECT completes */
        onProxyConnect?: (headers: Map<string, string>) => void;
        /** Additional axios instance options */
        axiosOptions?: object;
    }

    export interface ProxyAxiosInstance extends AxiosInstance {
        proxyAgent: ProxyHeadersAgent;
    }

    export function createProxyAxios(options: CreateProxyAxiosOptions): Promise<ProxyAxiosInstance>;
    
    export function get(
        url: string,
        options: CreateProxyAxiosOptions & { config?: object }
    ): Promise<AxiosResponse>;
    
    export function post(
        url: string,
        data: any,
        options: CreateProxyAxiosOptions & { config?: object }
    ): Promise<AxiosResponse>;
}

// =============================================================================
// node-fetch Types
// =============================================================================

declare module 'javascript-proxy-headers/node-fetch' {
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
        options: ProxyFetchOptions
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
        options: CreateProxyFetchOptions
    ): (url: string | URL, fetchOptions?: RequestInit & { proxyHeaders?: Record<string, string> }) => Promise<ProxyResponse>;
}

// =============================================================================
// Got Types
// =============================================================================

declare module 'javascript-proxy-headers/got' {
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

    export function createProxyGot(options: CreateProxyGotOptions): Promise<ProxyGotInstance>;
    
    export function proxyGet(
        url: string,
        options: CreateProxyGotOptions & { gotOptions?: object }
    ): Promise<GotResponse>;
    
    export function proxyPost(
        url: string,
        options: CreateProxyGotOptions & { gotOptions?: object }
    ): Promise<GotResponse>;
}

// =============================================================================
// Undici Types
// =============================================================================

declare module 'javascript-proxy-headers/undici' {
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
        options: UndiciRequestOptions
    ): Promise<UndiciResponse>;

    export function get(
        url: string | URL,
        options: Omit<UndiciRequestOptions, 'method'>
    ): Promise<UndiciResponse>;

    export function post(
        url: string | URL,
        options: Omit<UndiciRequestOptions, 'method'>
    ): Promise<UndiciResponse>;

    export { ConnectError } from 'javascript-proxy-headers';
}

// =============================================================================
// SuperAgent Types
// =============================================================================

declare module 'javascript-proxy-headers/superagent' {
    import type { SuperAgentRequest, Response } from 'superagent';

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
        options: ProxyPluginOptions
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
        options: ProxyPluginOptions
    ): Promise<ProxySuperagentClient>;
}
