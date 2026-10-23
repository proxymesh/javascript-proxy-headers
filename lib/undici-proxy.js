/**
 * Undici extension for proxy header support.
 *
 * HTTPS requests use a custom undici connector. Passing an already-open
 * tunnel as `connect: { socket }` does not work: undici's default connector
 * (`lib/core/connect.js`) only upgrades `httpSocket` and otherwise dials
 * `host` itself, which bypasses the proxy and leaks the client IP.
 * The connector below never dials the origin. It reuses ProxyHeadersAgent,
 * which sends CONNECT (including custom headers) and returns the TLS socket
 * only after the proxy tunnel is up. CONNECT response headers are read from
 * that socket.
 */

import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';
import { getProxyHeadersFromSocket } from './core/proxy-headers-store.js';

/**
 * Make an HTTP request through a proxy with custom headers.
 *
 * @param {string|URL} url - Target URL
 * @param {Object} options - Request options
 * @param {string} options.proxy - Proxy URL (e.g., 'http://user:pass@proxy:8080')
 * @param {Object} [options.proxyHeaders] - Headers to send to the proxy
 * @param {Object} [options.proxyTlsOptions] - TLS options for an https:// proxy
 * @param {Object} [options.requestTls] - TLS options for the origin (https only)
 * @param {string} [options.method] - HTTP method (default: 'GET')
 * @param {Object} [options.headers] - Request headers
 * @param {*} [options.body] - Request body
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
    const {
        proxy,
        proxyHeaders = {},
        proxyTlsOptions = {},
        requestTls = {},
        tlsOptions,
        ...requestOptions
    } = options;

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
        const proxyAgent = createHttpProxyAgent(undici, proxy, proxyHeaders, proxyTlsOptions);

        try {
            const response = await undici.request(url, {
                ...requestOptions,
                dispatcher: proxyAgent,
            });

            return {
                statusCode: response.statusCode,
                headers: response.headers,
                body: response.body,
                // Plain HTTP is forwarded, not CONNECT-tunneled, so there is
                // no separate CONNECT response to capture.
                proxyHeaders: new Map(),
            };
        } finally {
            await proxyAgent.close();
        }
    }

    const origin = `${targetUrl.protocol}//${targetUrl.host}`;
    const targetPort = parseInt(targetUrl.port, 10) || 443;
    const agent = new ProxyHeadersAgent(proxy, {
        proxyHeaders,
        proxyTlsOptions,
        tlsOptions: { ...requestTls, ...tlsOptions },
    });

    /** @type {Map<string, string>|null} */
    let connectHeaders = null;
    let client;

    try {
        client = new undici.Client(origin, {
            connect(opts, callback) {
                let settled = false;
                const done = (err, socket) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    if (err) {
                        callback(err);
                        return;
                    }
                    connectHeaders = getProxyHeadersFromSocket(socket)
                        || agent.lastProxyHeaders
                        || new Map();
                    callback(null, socket);
                };

                try {
                    agent.createConnection({
                        host: opts.hostname,
                        port: opts.port || targetPort,
                    }, done);
                } catch (err) {
                    done(err);
                }
            },
        });

        const response = await client.request({
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: requestOptions.method || 'GET',
            headers: requestOptions.headers,
            body: requestOptions.body,
        });

        return {
            statusCode: response.statusCode,
            headers: response.headers,
            body: response.body,
            proxyHeaders: connectHeaders || new Map(),
        };
    } finally {
        // Don't await close before the caller can read `body` (close waits
        // for the in-flight response). The tunnel socket is owned by undici,
        // not by the agent's pool.
        if (client) {
            client.close().catch(() => {});
        }
        agent.destroy();
    }
}

/**
 * ProxyAgent for plain HTTP. `headers` is undici's CONNECT/proxy header
 * option (undici PR #1877). Older ProxyAgent builds that reject the option
 * fall back to a URL-only agent.
 * @param {typeof import('undici')} undici
 * @param {string} proxy
 * @param {Record<string, string>} proxyHeaders
 * @param {object} proxyTlsOptions
 */
function createHttpProxyAgent(undici, proxy, proxyHeaders, proxyTlsOptions) {
    const proxyOptions = { uri: proxy };
    if (proxyTlsOptions && Object.keys(proxyTlsOptions).length > 0) {
        proxyOptions.proxyTls = proxyTlsOptions;
    }
    if (proxyHeaders && Object.keys(proxyHeaders).length > 0) {
        proxyOptions.headers = proxyHeaders;
    }
    try {
        return new undici.ProxyAgent(proxyOptions);
    } catch {
        return new undici.ProxyAgent(proxy);
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

export { ConnectError } from './core/connect-parser.js';
