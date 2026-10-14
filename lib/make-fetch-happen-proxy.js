/**
 * make-fetch-happen extension for proxy header support.
 *
 * Passes a ProxyHeadersAgent via opts.agent; @npmcli/agent returns it as-is when set.
 */

import makeFetchHappen from 'make-fetch-happen';
import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';
import { ProxyResponse } from './core/proxy-response.js';
import { getProxyHeaders, runWithProxyHeadersContext, takeProxyHeadersContext } from './core/proxy-headers-store.js';

function requestUrlKey(url, res) {
    if (typeof url === 'string') {
        return url;
    }
    if (url instanceof URL) {
        return url.href;
    }
    if (url && typeof url.url === 'string') {
        return url.url;
    }
    return res?.url || '';
}

/**
 * Cache hits never CONNECT, so ALS and the Response have no tunnel socket.
 * Remember CONNECT headers from the live fetch and restore them by URL.
 * Never fall back to lastProxyHeaders (last-write-wins across the shared agent).
 * @param {Function} fetchImpl
 * @param {ProxyHeadersAgent} agent
 * @param {Map<string, Map<string, string>>} [cachedProxyHeaders]
 */
function wrapFetchWithProxyResponse(fetchImpl, agent, cachedProxyHeaders = new Map()) {
    const wrapped = (url, opts = {}) =>
        runWithProxyHeadersContext(async () => {
            const res = await fetchImpl(url, opts);
            const live = getProxyHeaders(res) || takeProxyHeadersContext();
            if (live instanceof Map) {
                const key = requestUrlKey(url, res);
                if (key) {
                    cachedProxyHeaders.set(key, live);
                }
                if (res?.url) {
                    cachedProxyHeaders.set(res.url, live);
                }
                return new ProxyResponse(res, live);
            }
            const stored =
                cachedProxyHeaders.get(res?.url) ||
                cachedProxyHeaders.get(requestUrlKey(url, res)) ||
                new Map();
            return new ProxyResponse(res, stored);
        });

    wrapped.defaults = (defaultUrl, defaultOptions = {}) => {
        const inner = fetchImpl.defaults(defaultUrl, defaultOptions);
        return wrapFetchWithProxyResponse(inner, agent, cachedProxyHeaders);
    };

    wrapped.proxyAgent = agent;
    return wrapped;
}

/**
 * Create a make-fetch-happen fetch function with proxy header support.
 *
 * @param {Object} options - Configuration
 * @param {string} options.proxy - Proxy URL
 * @param {Object} [options.proxyHeaders] - Headers to send on CONNECT
 * @param {Function} [options.onProxyConnect] - CONNECT callback
 * @param {Object} [options.defaults] - Extra options for make-fetch-happen.defaults()
 * @returns {Function} Fetch function with .defaults() and .proxyAgent
 */
export function createProxyMakeFetchHappen(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect, proxyTlsOptions, ...makeFetchHappenOptions } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    const agent = new ProxyHeadersAgent(proxy, {
        proxyHeaders,
        onProxyConnect,
        proxyTlsOptions,
    });

    const inner = makeFetchHappen.defaults({
        ...makeFetchHappenOptions,
        agent,
    });

    return wrapFetchWithProxyResponse(inner, agent);
}
