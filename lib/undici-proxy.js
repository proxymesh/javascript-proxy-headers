/**
 * Undici extension for proxy header support.
 *
 * Provides wrappers around undici's request function that support
 * sending custom headers to proxies and receiving proxy response headers.
 */

import net from 'net';
import { parseProxyUrl, buildConnectRequest } from './core/utils.js';
import { parseConnectResponse, hasCompleteHeaders, ConnectError } from './core/connect-parser.js';

/**
 * Create a tunnel through the proxy with custom headers.
 *
 * @param {Object} options - Tunnel options
 * @param {string} options.proxy - Proxy URL
 * @param {string} options.targetHost - Target hostname
 * @param {number} options.targetPort - Target port
 * @param {Object} options.proxyHeaders - Headers to send to proxy
 * @param {number} options.timeout - Timeout in ms
 * @returns {Promise<{ socket: net.Socket, proxyHeaders: Map<string, string> }>}
 */
async function createProxyTunnel(options) {
    const { proxy, targetHost, targetPort, proxyHeaders = {}, timeout = 30000 } = options;

    const proxyInfo = parseProxyUrl(proxy);

    return new Promise((resolve, reject) => {
        const socket = net.connect({
            host: proxyInfo.host,
            port: proxyInfo.port,
        });

        let buffer = Buffer.alloc(0);
        let timeoutId = null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            socket.removeAllListeners('data');
            socket.removeAllListeners('error');
            socket.removeAllListeners('close');
        };

        const handleError = (err) => {
            cleanup();
            socket.destroy();
            reject(err);
        };

        timeoutId = setTimeout(() => {
            handleError(new Error(`Proxy CONNECT timeout after ${timeout}ms`));
        }, timeout);

        socket.on('error', handleError);

        socket.on('close', () => {
            handleError(new Error('Proxy connection closed unexpectedly'));
        });

        socket.on('connect', () => {
            const connectRequest = buildConnectRequest(
                targetHost,
                targetPort,
                proxyInfo.auth,
                proxyHeaders
            );
            socket.write(connectRequest);
        });

        socket.on('data', (data) => {
            buffer = Buffer.concat([buffer, data]);

            if (!hasCompleteHeaders(buffer)) {
                return;
            }

            const response = parseConnectResponse(buffer);

            if (!response) {
                handleError(new Error('Invalid CONNECT response from proxy'));
                return;
            }

            cleanup();

            if (response.statusCode !== 200) {
                socket.destroy();
                reject(new ConnectError(
                    `Proxy CONNECT failed: ${response.statusCode} ${response.statusMessage}`,
                    response.statusCode,
                    response.statusMessage,
                    response.headers
                ));
                return;
            }

            resolve({
                socket,
                proxyHeaders: response.headers,
            });
        });
    });
}

/**
 * Make an HTTP request through a proxy with custom headers.
 *
 * @param {string|URL} url - Target URL
 * @param {Object} options - Request options
 * @param {string} options.proxy - Proxy URL (e.g., 'http://user:pass@proxy:8080')
 * @param {Object} options.proxyHeaders - Headers to send to the proxy
 * @param {string} options.method - HTTP method (default: 'GET')
 * @param {Object} options.headers - Request headers
 * @param {*} options.body - Request body
 * @returns {Promise<{ statusCode: number, headers: Object, body: *, proxyHeaders: Map<string, string> }>}
 *
 * @example
 * const { statusCode, headers, body, proxyHeaders } = await request(
 *     'https://httpbin.org/ip',
 *     {
 *         proxy: 'http://user:pass@proxy:8080',
 *         proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
 *     }
 * );
 *
 * console.log(proxyHeaders.get('x-proxymesh-ip'));
 */
export async function request(url, options = {}) {
    const { proxy, proxyHeaders = {}, ...requestOptions } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    let undici;
    try {
        undici = await import('undici');
    } catch {
        throw new Error('undici is required. Install it with: npm install undici');
    }

    const targetUrl = new URL(url);
    const isHttps = targetUrl.protocol === 'https:';

    if (!isHttps) {
        const proxyAgent = new undici.ProxyAgent(proxy);

        try {
            const response = await undici.request(url, {
                ...requestOptions,
                dispatcher: proxyAgent,
            });

            return {
                statusCode: response.statusCode,
                headers: response.headers,
                body: response.body,
                proxyHeaders: new Map(),
            };
        } finally {
            await proxyAgent.close();
        }
    }

    const targetHost = targetUrl.hostname;
    const targetPort = parseInt(targetUrl.port, 10) || 443;

    const tunnel = await createProxyTunnel({
        proxy,
        targetHost,
        targetPort,
        proxyHeaders,
    });

    const client = new undici.Client(`https://${targetHost}:${targetPort}`, {
        connect: {
            socket: tunnel.socket,
        },
    });

    try {
        const response = await client.request({
            path: targetUrl.pathname + targetUrl.search,
            method: requestOptions.method || 'GET',
            headers: requestOptions.headers,
            body: requestOptions.body,
        });

        return {
            statusCode: response.statusCode,
            headers: response.headers,
            body: response.body,
            proxyHeaders: tunnel.proxyHeaders,
        };
    } finally {
        await client.close();
    }
}

/**
 * GET request with proxy headers.
 */
export async function get(url, options) {
    return request(url, { ...options, method: 'GET' });
}

/**
 * POST request with proxy headers.
 */
export async function post(url, options) {
    return request(url, { ...options, method: 'POST' });
}

export { ConnectError };
