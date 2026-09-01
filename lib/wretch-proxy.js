/**
 * wretch extension for proxy header support.
 *
 * Wraps the wretch factory so each request chain uses a custom `fetch`
 * (node-fetch + ProxyHeadersAgent). wretch v3 uses per-chain `.fetchPolyfill()`
 * instead of the old module-level `.polyfills()`.
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
 * @returns {Promise<typeof import('wretch').default>} Wretch factory wired to proxy-header fetch
 */
export async function createProxyWretch(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect, proxyTlsOptions } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    let rawWretch;
    try {
        rawWretch = (await import('wretch')).default;
    } catch {
        throw new Error('wretch is required. Install it with: npm install wretch');
    }

    const fetchImpl = createProxyFetch({ proxy, proxyHeaders, onProxyConnect, proxyTlsOptions });

    function proxyWretch(url, opts) {
        return rawWretch(url, opts).fetchPolyfill(fetchImpl);
    }
    proxyWretch.default = proxyWretch;
    proxyWretch.WretchError = rawWretch.WretchError;

    return proxyWretch;
}
