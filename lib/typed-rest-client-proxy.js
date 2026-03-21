/**
 * typed-rest-client extension for proxy header support.
 *
 * Subclasses HttpClient so HTTPS requests use ProxyHeadersAgent instead of tunnel-agent.
 */

import { createRequire } from 'module';
import { ProxyHeadersAgent } from './core/proxy-headers-agent.js';

const require = createRequire(import.meta.url);

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
            });
        }

        _getAgent(parsedUrl) {
            if (parsedUrl.protocol === 'https:') {
                return this.proxyAgent;
            }
            return super._getAgent(parsedUrl);
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
    } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    const { RestClient } = require('typed-rest-client/RestClient');
    const { HttpClient } = require('typed-rest-client/HttpClient');

    const PHC = createProxyHeadersHttpClientClass(HttpClient);
    const PRC = createProxyHeadersRestClientClass(RestClient, PHC);

    const proxyOpts = { proxy, proxyHeaders, onProxyConnect };

    return new PRC(userAgent, baseUrl, handlers, requestOptions, proxyOpts);
}
