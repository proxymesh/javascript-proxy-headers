/**
 * typed-rest-client extension for proxy header support.
 *
 * Subclasses HttpClient so HTTPS requests use ProxyHeadersAgent instead of tunnel-agent.
 */

import { createRequire } from 'module';
import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';
import { getProxyHeaders } from './core/proxy-headers-store.js';

const require = createRequire(import.meta.url);

/**
 * Copy CONNECT headers onto a RestClient result (or rejected error).
 * typed-rest-client v2/v3 call `processResponse`, which builds a fresh object.
 * @param {Promise<object>|object} processed
 * @param {object} res HttpClientResponse
 */
function attachRestProxyHeaders(processed, res) {
    const headers = res?.proxyHeaders || getProxyHeaders(res?.message) || new Map();
    const attach = (out) => {
        if (out) {
            out.proxyHeaders = headers;
        }
        return out;
    };
    const attachErr = (err) => {
        if (err && typeof err === 'object') {
            err.proxyHeaders = headers;
        }
        return Promise.reject(err);
    };
    if (processed && typeof processed.then === 'function') {
        return processed.then(attach, attachErr);
    }
    return attach(processed);
}

/**
 * @param {import('typed-rest-client/HttpClient').HttpClient} Base
 */
function createProxyHeadersHttpClientClass(HttpClient) {
    return class ProxyHeadersHttpClient extends HttpClient {
        /**
         * @param {string} userAgent
         * @param {unknown[]} handlers
         * @param {object} [requestOptions]
         * @param {object} proxyOpts
         * @param {string} proxyOpts.proxy
         * @param {Record<string, string>} [proxyOpts.proxyHeaders]
         * @param {Function} [proxyOpts.onProxyConnect]
         */
        constructor(userAgent, handlers, requestOptions, proxyOpts) {
            const ro = requestOptions ? { ...requestOptions, proxy: undefined } : undefined;
            super(userAgent, handlers, ro);
            this.proxyAgent = new ProxyHeadersAgent(proxyOpts.proxy, {
                proxyHeaders: proxyOpts.proxyHeaders || {},
                onProxyConnect: proxyOpts.onProxyConnect,
                proxyTlsOptions: proxyOpts.proxyTlsOptions,
            });
        }

        _getAgent(parsedUrl) {
            if (parsedUrl.protocol === 'https:') {
                return this.proxyAgent;
            }
            return super._getAgent(parsedUrl);
        }

        request(verb, requestUrl, data, headers) {
            const result = super.request(verb, requestUrl, data, headers);
            const attach = (res) => {
                if (res) {
                    res.proxyHeaders = getProxyHeaders(res.message) || new Map();
                }
                return res;
            };
            if (result && typeof result.then === 'function') {
                return result.then(attach);
            }
            return attach(result);
        }
    };
}

/**
 * RestClient with ProxyHeadersAgent for HTTPS.
 *
 * @param {import('typed-rest-client/RestClient').RestClient} RestClient
 * @param {ReturnType<createProxyHeadersHttpClientClass>} ProxyHeadersHttpClient
 */
function createProxyHeadersRestClientClass(RestClient, ProxyHeadersHttpClient) {
    return class ProxyHeadersRestClient extends RestClient {
        /**
         * @param {string} userAgent
         * @param {string} [baseUrl]
         * @param {unknown[]} [handlers]
         * @param {object} [requestOptions]
         * @param {object} proxyOpts
         */
        constructor(userAgent, baseUrl, handlers, requestOptions, proxyOpts) {
            super(userAgent, baseUrl, handlers, requestOptions ? { ...requestOptions, proxy: undefined } : undefined);
            this.client = new ProxyHeadersHttpClient(
                userAgent,
                handlers || [],
                requestOptions ? { ...requestOptions, proxy: undefined } : undefined,
                proxyOpts,
            );
            this.proxyAgent = this.client.proxyAgent;
        }

        processResponse(res, options) {
            return attachRestProxyHeaders(super.processResponse(res, options), res);
        }

        // typed-rest-client v1 used _processResponse; keep a shim if present.
        _processResponse(res, options) {
            if (typeof super._processResponse === 'function') {
                return attachRestProxyHeaders(super._processResponse(res, options), res);
            }
            return this.processResponse(res, options);
        }
    };
}

/**
 * Create a RestClient that supports custom proxy CONNECT headers.
 *
 * @param {Object} options
 * @param {string} options.userAgent
 * @param {string} [options.baseUrl]
 * @param {unknown[]} [options.handlers]
 * @param {object} [options.requestOptions]
 * @param {string} options.proxy
 * @param {Record<string, string>} [options.proxyHeaders]
 * @param {Function} [options.onProxyConnect]
 */
export function createProxyRestClient(options) {
    const {
        userAgent,
        baseUrl,
        handlers,
        requestOptions,
        proxy,
        proxyHeaders = {},
        onProxyConnect,
        proxyTlsOptions,
    } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    const { RestClient } = require('typed-rest-client/RestClient');
    const { HttpClient } = require('typed-rest-client/HttpClient');

    const PHC = createProxyHeadersHttpClientClass(HttpClient);
    const PRC = createProxyHeadersRestClientClass(RestClient, PHC);

    const proxyOpts = { proxy, proxyHeaders, onProxyConnect, proxyTlsOptions };

    return new PRC(userAgent, baseUrl, handlers, requestOptions, proxyOpts);
}
