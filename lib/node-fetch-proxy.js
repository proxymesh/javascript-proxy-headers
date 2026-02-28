/**
 * node-fetch extension for proxy header support.
 *
 * Provides a fetch wrapper that supports sending custom headers to proxies
 * and receiving proxy response headers.
 */

import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';

/**
 * Extended Response class that includes proxy headers.
 */
class ProxyResponse {
    constructor(response, proxyHeaders) {
        this._response = response;
        this.proxyHeaders = proxyHeaders || new Map();

        this.ok = response.ok;
        this.status = response.status;
        this.statusText = response.statusText;
        this.headers = response.headers;
        this.url = response.url;
        this.redirected = response.redirected;
        this.type = response.type;
        this.body = response.body;
        this.bodyUsed = response.bodyUsed;
    }

    async text() {
        return this._response.text();
    }

    async json() {
        return this._response.json();
    }

    async blob() {
        return this._response.blob();
    }

    async arrayBuffer() {
        return this._response.arrayBuffer();
    }

    async formData() {
        return this._response.formData();
    }

    clone() {
        return new ProxyResponse(this._response.clone(), this.proxyHeaders);
    }
}

/**
 * Fetch with proxy header support.
 *
 * @param {string|URL} url - Target URL
 * @param {Object} options - Fetch options
 * @param {string} options.proxy - Proxy URL (e.g., 'http://user:pass@proxy:8080')
 * @param {Object} options.proxyHeaders - Headers to send to the proxy
 * @param {Function} options.onProxyConnect - Callback when CONNECT completes
 * @returns {Promise<ProxyResponse>}
 *
 * @example
 * const response = await proxyFetch('https://httpbin.org/ip', {
 *     proxy: 'http://user:pass@proxy:8080',
 *     proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
 * });
 *
 * console.log(response.proxyHeaders.get('x-proxymesh-ip'));
 * const data = await response.json();
 */
export async function proxyFetch(url, options = {}) {
    const { proxy, proxyHeaders = {}, onProxyConnect, ...fetchOptions } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    let fetch;
    try {
        fetch = (await import('node-fetch')).default;
    } catch {
        throw new Error('node-fetch is required. Install it with: npm install node-fetch');
    }

    const agent = new ProxyHeadersAgent(proxy, {
        proxyHeaders,
        onProxyConnect,
    });

    const response = await fetch(url, {
        ...fetchOptions,
        agent,
    });

    return new ProxyResponse(response, agent.lastProxyHeaders);
}

/**
 * Create a fetch function bound to a specific proxy configuration.
 *
 * @param {Object} options - Proxy configuration
 * @param {string} options.proxy - Proxy URL
 * @param {Object} options.proxyHeaders - Default headers to send to proxy
 * @returns {Function} - Configured fetch function
 *
 * @example
 * const fetch = createProxyFetch({
 *     proxy: 'http://proxy:8080',
 *     proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
 * });
 *
 * const response = await fetch('https://httpbin.org/ip');
 */
export function createProxyFetch(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect } = options;

    return (url, fetchOptions = {}) => {
        return proxyFetch(url, {
            proxy,
            proxyHeaders: { ...proxyHeaders, ...fetchOptions.proxyHeaders },
            onProxyConnect,
            ...fetchOptions,
        });
    };
}

export { ProxyResponse };
