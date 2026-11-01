/**
 * ky extension for proxy header support.
 *
 * Uses a custom `fetch` backed by node-fetch + ProxyHeadersAgent.
 * ky 2.2+ requires `fetch` to resolve with a global `Response`
 * (`instanceof Response` or `[object Response]`). node-fetch's Response
 * and the ProxyResponse wrapper fail that check, so ky 2 receives a
 * native Response with `proxyHeaders` attached. `clone()` does not copy
 * that own property.
 */

import { Readable } from 'node:stream';
import { createProxyFetch } from './node-fetch-proxy.js';

const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);
const DROP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-connection',
    'transfer-encoding',
    'upgrade',
    'trailer',
    'te',
    // node-fetch already decompresses when Content-Encoding is set, but leaves
    // the header in place. Copying it makes the native Response decode twice.
    'content-encoding',
    'content-length',
]);

/**
 * @param {import('./core/proxy-response.js').ProxyResponse} proxyResponse
 * @returns {Response}
 */
function toNativeResponse(proxyResponse) {
    if (typeof Response !== 'undefined' && proxyResponse instanceof Response) {
        if (!proxyResponse.proxyHeaders) {
            proxyResponse.proxyHeaders = new Map();
        }
        return proxyResponse;
    }

    const status = Number(proxyResponse.status ?? 200);
    const nullBody = NULL_BODY_STATUS.has(status);
    let body = null;
    if (!nullBody && proxyResponse.body) {
        const stream = proxyResponse.body;
        body = typeof stream.getReader === 'function'
            ? stream
            : Readable.toWeb(stream);
    }

    const native = new Response(body, {
        status,
        statusText: proxyResponse.statusText || '',
        headers: copyHeaders(proxyResponse.headers),
    });
    native.proxyHeaders = proxyResponse.proxyHeaders || new Map();
    return native;
}

/**
 * @param {{ raw?: () => Record<string, string[]>, entries?: () => Iterable<[string, string]> }|undefined} source
 * @returns {Headers}
 */
function copyHeaders(source) {
    const headers = new Headers();
    if (!source) {
        return headers;
    }
    const raw = typeof source.raw === 'function' ? source.raw() : null;
    const pairs = raw
        ? Object.entries(raw).flatMap(([name, values]) =>
            [].concat(values).map((value) => [name, value]))
        : [...source.entries()];
    for (const [name, value] of pairs) {
        if (value == null || DROP_HEADERS.has(String(name).toLowerCase())) {
            continue;
        }
        try {
            headers.append(name, String(value));
        } catch {
            // The Fetch implementation rejects some header names.
        }
    }
    return headers;
}

/**
 * Create a ky instance with proxy header support.
 *
 * @param {Object} options - Configuration
 * @param {string} options.proxy - Proxy URL
 * @param {Object} [options.proxyHeaders] - Headers to send on CONNECT
 * @param {Function} [options.onProxyConnect] - CONNECT callback
 * @param {Object} [options.proxyTlsOptions] - TLS options for an https:// proxy
 * @param {Object} [options.kyOptions] - Options passed to ky.create()
 * @returns {Promise<import('ky').KyInstance>}
 */
export async function createProxyKy(options) {
    const { proxy, proxyHeaders = {}, onProxyConnect, proxyTlsOptions, kyOptions = {} } = options;

    if (!proxy) {
        throw new Error('proxy option is required');
    }

    let ky;
    try {
        ky = (await import('ky')).default;
    } catch {
        throw new Error('ky is required. Install it with: npm install ky');
    }

    const fetchImpl = createProxyFetch({ proxy, proxyHeaders, onProxyConnect, proxyTlsOptions });
    const fetch = async (input, init) => toNativeResponse(await fetchImpl(input, init));

    return ky.create({
        ...kyOptions,
        fetch,
    });
}
