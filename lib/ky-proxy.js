/**
 * ky extension for proxy header support.
 *
 * Uses a custom `fetch` backed by node-fetch + ProxyHeadersAgent.
 */

import { createProxyFetch } from './node-fetch-proxy.js';

/**
 * Create a ky instance with proxy header support.
 *
 * @param {Object} options - Configuration
 * @param {string} options.proxy - Proxy URL
 * @param {Object} [options.proxyHeaders] - Headers to send on CONNECT
 * @param {Function} [options.onProxyConnect] - CONNECT callback
 * @param {Object} [options.kyOptions] - Options passed to ky.create()
 * @returns {Promise<import('ky').KyInstance>}
 */
export async function createProxyKy(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect, kyOptions = {} } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    let ky;
    try {
        ky = (await import('ky')).default;
    } catch {
        throw new Error('ky is required. Install it with: npm install ky');
    }

    const fetch = createProxyFetch({ proxy, proxyHeaders, onProxyConnect });

    return ky.create({
        ...kyOptions,
        fetch,
    });
}
