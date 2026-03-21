/**
 * needle extension for proxy header support.
 */

import { createRequire } from 'module';
import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';

const require = createRequire(import.meta.url);

function mergeProxyHeadersIntoResponse(res, map) {
    if (!res || !map) return;
    for (const [key, value] of map) {
        if (res.headers[key] == null) {
            res.headers[key] = value;
        }
    }
}

/**
 * Perform a GET with proxy headers (promise-based).
 *
 * @param {string} url - Target URL (HTTPS recommended)
 * @param {Object} options - Options
 * @param {string} options.proxy - Proxy URL
 * @param {Object} [options.proxyHeaders] - CONNECT headers
 * @param {Function} [options.onProxyConnect] - CONNECT callback
 * @param {Object} [options.needleOptions] - Extra needle options
 * @returns {Promise<import('needle').NeedleResponse>}
 */
export async function proxyNeedleGet(url, options = {}) {
    const { proxy, proxyHeaders = {}, onProxyConnect, needleOptions = {} } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    const needle = require('needle');

    const agent = new ProxyHeadersAgent(proxy, {
        proxyHeaders,
        onProxyConnect,
    });

    return new Promise((resolve, reject) => {
        needle.get(
            url,
            {
                ...needleOptions,
                agent,
                proxy: null,
                use_proxy_from_env_var: false,
            },
            (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                mergeProxyHeadersIntoResponse(res, agent.lastProxyHeaders);
                res.proxyAgent = agent;
                resolve(res);
            },
        );
    });
}

/**
 * Create a small API bound to one proxy configuration.
 *
 * @param {Object} options - Same as proxyNeedleGet base options (without url)
 * @returns {{ get: Function, proxyAgent: ProxyHeadersAgent }}
 */
export function createProxyNeedle(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect, needleOptions = {} } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    const agent = new ProxyHeadersAgent(proxy, {
        proxyHeaders,
        onProxyConnect,
    });

    const needle = require('needle');

    return {
        proxyAgent: agent,
        get(url, opts = {}) {
            return new Promise((resolve, reject) => {
                needle.get(
                    url,
                    {
                        ...needleOptions,
                        ...opts,
                        agent,
                        proxy: null,
                        use_proxy_from_env_var: false,
                    },
                    (err, res) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        mergeProxyHeadersIntoResponse(res, agent.lastProxyHeaders);
                        res.proxyAgent = agent;
                        resolve(res);
                    },
                );
            });
        },
    };
}
