/**
 * make-fetch-happen extension for proxy header support.
 *
 * Passes a ProxyHeadersAgent via opts.agent; @npmcli/agent returns it as-is when set.
 */

import makeFetchHappen from 'make-fetch-happen';
import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';
import { ProxyResponse } from './core/proxy-response.js';

function wrapFetchWithProxyResponse(fetchImpl, agent) {
    const wrapped = (url, opts = {}) =>
        fetchImpl(url, opts).then((res) => new ProxyResponse(res, agent.lastProxyHeaders));

    wrapped.defaults = (defaultUrl, defaultOptions = {}) => {
        const inner = fetchImpl.defaults(defaultUrl, defaultOptions);
        return wrapFetchWithProxyResponse(inner, agent);
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
    const { proxy, proxyHeaders = {}, onProxyConnect, ...makeFetchHappenOptions } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    const agent = new ProxyHeadersAgent(proxy, {
        proxyHeaders,
        onProxyConnect,
    });

    const inner = makeFetchHappen.defaults({
        ...makeFetchHappenOptions,
        agent,
    });

    return wrapFetchWithProxyResponse(inner, agent);
}
