/**
 * Axios extension for proxy header support.
 *
 * Provides a factory function to create axios instances that support
 * sending custom headers to proxies and receiving proxy response headers.
 */

import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';

/**
 * Create an axios instance with proxy header support.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.proxy - Proxy URL (e.g., 'http://user:pass@proxy:8080')
 * @param {Object} options.proxyHeaders - Headers to send to the proxy
 * @param {Function} options.onProxyConnect - Callback when CONNECT completes
 * @param {Object} options.axiosOptions - Additional axios instance options
 * @returns {import('axios').AxiosInstance}
 *
 * @example
 * const client = createProxyAxios({
 *     proxy: 'http://user:pass@proxy:8080',
 *     proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
 * });
 *
 * const response = await client.get('https://httpbin.org/ip');
 * console.log(response.headers['x-proxymesh-ip']);
 */
export async function createProxyAxios(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect, axiosOptions = {} } = options;

    let axios;
    try {
        axios = (await import('axios')).default;
    } catch {
        throw new Error('axios is required. Install it with: npm install axios');
    }

    const agent = new ProxyHeadersAgent(proxy, {
        proxyHeaders,
        onProxyConnect,
    });

    const instance = axios.create({
        ...axiosOptions,
        httpsAgent: agent,
        httpAgent: agent,
        proxy: false,
    });

    instance.interceptors.response.use((response) => {
        if (agent.lastProxyHeaders) {
            for (const [key, value] of agent.lastProxyHeaders) {
                if (!response.headers[key]) {
                    response.headers[key] = value;
                }
            }
        }
        return response;
    });

    instance.proxyAgent = agent;

    return instance;
}

/**
 * Make a single request with proxy headers.
 *
 * @param {string} method - HTTP method
 * @param {string} url - Target URL
 * @param {Object} options - Request options
 * @param {string} options.proxy - Proxy URL
 * @param {Object} options.proxyHeaders - Headers to send to proxy
 * @param {Object} options.config - Axios request config
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export async function proxyRequest(method, url, options) {
    const client = await createProxyAxios(options);
    return client.request({ method, url, ...options.config });
}

/**
 * GET request with proxy headers.
 */
export async function get(url, options) {
    return proxyRequest('get', url, options);
}

/**
 * POST request with proxy headers.
 */
export async function post(url, data, options) {
    return proxyRequest('post', url, { ...options, config: { data, ...options?.config } });
}
