/**
 * JavaScript Proxy Headers - TypeScript Definitions
 */

import { Agent } from 'https';

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
