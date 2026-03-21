/**
 * wretch extension for proxy header support.
 *
 * Registers a custom `fetch` (node-fetch + ProxyHeadersAgent) as wretch's fetch polyfill.
 * wretch stores polyfills on a module singleton; avoid mixing different proxy configs
 * in the same process without coordinating polyfills.
 *
 * @example
 * const wretch = await createProxyWretch({ proxy: 'http://proxy:8080' });
 * const res = await wretch('https://example.com').get().res();
 * console.log(res.proxyHeaders.get('x-proxymesh-ip'));
 */

import { createProxyFetch } from './node-fetch-proxy.js';

/**
 * Configure wretch to use proxy-header fetch and return the wretch factory.
 *
 * @param {Object} options - Configuration
 * @param {string} options.proxy - Proxy URL
 * @param {Object} [options.proxyHeaders] - Headers to send on CONNECT
 * @param {Function} [options.onProxyConnect] - CONNECT callback
 * @returns {Promise<import('wretch').Wretch>} Default wretch export after polyfills are set
 */
export async function createProxyWretch(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    let wretch;
    try {
        wretch = (await import('wretch')).default;
    } catch {
        throw new Error('wretch is required. Install it with: npm install wretch');
    }

    const fetch = createProxyFetch({ proxy, proxyHeaders, onProxyConnect });
    wretch.polyfills({ fetch });

    return wretch;
}
