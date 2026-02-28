/**
 * SuperAgent extension for proxy header support.
 *
 * Provides a plugin for superagent that supports sending custom headers
 * to proxies and receiving proxy response headers.
 */

import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';

/**
 * Create a superagent plugin for proxy header support.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.proxy - Proxy URL (e.g., 'http://user:pass@proxy:8080')
 * @param {Object} options.proxyHeaders - Headers to send to the proxy
 * @param {Function} options.onProxyConnect - Callback when CONNECT completes
 * @returns {Function} - SuperAgent plugin function
 *
 * @example
 * import superagent from 'superagent';
 * import { proxyPlugin } from 'javascript-proxy-headers/superagent';
 *
 * const response = await superagent
 *     .get('https://httpbin.org/ip')
 *     .use(proxyPlugin({
 *         proxy: 'http://proxy:8080',
 *         proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
 *     }));
 *
 * console.log(response.headers['x-proxymesh-ip']);
 */
export function proxyPlugin(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    const agent = new ProxyHeadersAgent(proxy, {
        proxyHeaders,
        onProxyConnect,
    });

    return (request) => {
        request.agent(agent);

        const originalEnd = request.end.bind(request);
        request.end = function (callback) {
            return originalEnd((err, res) => {
                if (!err && res && agent.lastProxyHeaders) {
                    res.proxyHeaders = agent.lastProxyHeaders;
                    for (const [key, value] of agent.lastProxyHeaders) {
                        if (!res.headers[key]) {
                            res.headers[key] = value;
                        }
                    }
                }
                if (callback) {
                    callback(err, res);
                }
            });
        };

        request.proxyAgent = agent;

        return request;
    };
}

/**
 * Create a superagent instance bound to a specific proxy configuration.
 *
 * @param {Object} options - Proxy configuration
 * @returns {Object} - Object with get, post, etc. methods
 *
 * @example
 * const client = createProxySuperagent({
 *     proxy: 'http://proxy:8080',
 *     proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
 * });
 *
 * const response = await client.get('https://httpbin.org/ip');
 */
export async function createProxySuperagent(options) {
    let superagent;
    try {
        superagent = (await import('superagent')).default;
    } catch {
        throw new Error('superagent is required. Install it with: npm install superagent');
    }

    const plugin = proxyPlugin(options);

    return {
        get: (url) => superagent.get(url).use(plugin),
        post: (url) => superagent.post(url).use(plugin),
        put: (url) => superagent.put(url).use(plugin),
        delete: (url) => superagent.delete(url).use(plugin),
        patch: (url) => superagent.patch(url).use(plugin),
        head: (url) => superagent.head(url).use(plugin),
    };
}
