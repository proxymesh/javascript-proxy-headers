/**
 * Got extension for proxy header support.
 *
 * Provides a got instance factory that supports sending custom headers
 * to proxies and receiving proxy response headers.
 */

import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';

/**
 * Create a got instance with proxy header support.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.proxy - Proxy URL (e.g., 'http://user:pass@proxy:8080')
 * @param {Object} options.proxyHeaders - Headers to send to the proxy
 * @param {Function} options.onProxyConnect - Callback when CONNECT completes
 * @param {Object} options.gotOptions - Additional got instance options
 * @returns {import('got').Got}
 *
 * @example
 * const client = createProxyGot({
 *     proxy: 'http://user:pass@proxy:8080',
 *     proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
 * });
 *
 * const response = await client('https://httpbin.org/ip');
 * console.log(response.headers['x-proxymesh-ip']);
 */
export async function createProxyGot(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect, gotOptions = {} } = options;

    let got;
    try {
        got = (await import('got')).default;
    } catch {
        throw new Error('got is required. Install it with: npm install got');
    }

    const agent = new ProxyHeadersAgent(proxy, {
        proxyHeaders,
        onProxyConnect,
    });

    const instance = got.extend({
        ...gotOptions,
        agent: {
            https: agent,
        },
        hooks: {
            afterResponse: [
                (response) => {
                    if (agent.lastProxyHeaders) {
                        response.proxyHeaders = agent.lastProxyHeaders;
                        for (const [key, value] of agent.lastProxyHeaders) {
                            if (!response.headers[key]) {
                                response.headers[key] = value;
                            }
                        }
                    }
                    return response;
                },
                ...(gotOptions.hooks?.afterResponse || []),
            ],
        },
    });

    instance.proxyAgent = agent;

    return instance;
}

/**
 * Make a single request with proxy headers using got.
 *
 * @param {string} url - Target URL
 * @param {Object} options - Request options
 * @param {string} options.proxy - Proxy URL
 * @param {Object} options.proxyHeaders - Headers to send to proxy
 * @param {Object} options.gotOptions - Got request options
 * @returns {Promise<import('got').Response>}
 */
export async function proxyGet(url, options) {
    const client = await createProxyGot(options);
    return client(url, options.gotOptions);
}

/**
 * POST request with proxy headers.
 */
export async function proxyPost(url, options) {
    const client = await createProxyGot(options);
    return client.post(url, options.gotOptions);
}
