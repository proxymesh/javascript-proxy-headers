/**
 * Per-connection CONNECT header storage.
 *
 * Headers are attached to the tunnel/TLS socket so concurrent requests on a
 * shared agent cannot overwrite each other. AsyncLocalStorage is a fallback
 * for fetch wrappers that do not expose the underlying socket.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export const kProxyHeaders = Symbol.for('javascript-proxy-headers.proxyHeaders');

const proxyHeadersStorage = new AsyncLocalStorage();

/**
 * Record CONNECT response headers on a socket and any active ALS context.
 * @param {import('node:net').Socket|null|undefined} socket
 * @param {Map<string, string>|null|undefined} headers
 */
export function attachProxyHeaders(socket, headers) {
    if (headers && socket) {
        socket[kProxyHeaders] = headers;
    }
    const store = proxyHeadersStorage.getStore();
    if (store && headers) {
        store.headers = headers;
    }
}

/**
 * Walk a socket (and TLS parent chain) for attached CONNECT headers.
 * @param {object|null|undefined} socket
 * @returns {Map<string, string>|undefined}
 */
export function getProxyHeadersFromSocket(socket) {
    const seen = new Set();
    let current = socket;
    while (current && !seen.has(current)) {
        seen.add(current);
        if (current[kProxyHeaders] instanceof Map) {
            return current[kProxyHeaders];
        }
        current = current._parent || current.socket;
    }
    return undefined;
}

/**
 * Resolve CONNECT headers from a socket, IncomingMessage, or HTTP client response.
 * @param {object|null|undefined} source
 * @returns {Map<string, string>|undefined}
 */
export function getProxyHeaders(source) {
    if (!source) {
        const store = proxyHeadersStorage.getStore();
        return store?.headers;
    }
    if (source instanceof Map) {
        return source;
    }
    if (source[kProxyHeaders] instanceof Map) {
        return source[kProxyHeaders];
    }

    const candidates = [
        source,
        source.socket,
        source.connection,
        source.request,
        source.request?.socket,
        source.request?.connection,
        source.request?.res,
        source.request?.res?.socket,
        source.req,
        source.req?.socket,
        source.req?.connection,
        source.res,
        source.res?.socket,
        source.message,
        source.message?.socket,
    ];

    for (const candidate of candidates) {
        const found = getProxyHeadersFromSocket(candidate);
        if (found) {
            return found;
        }
    }

    return proxyHeadersStorage.getStore()?.headers;
}

/**
 * Run `fn` with an ALS store so CONNECT headers can be recovered without a socket.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function runWithProxyHeadersContext(fn) {
    return proxyHeadersStorage.run({ headers: null }, fn);
}

/**
 * CONNECT headers captured in the current ALS store, if any.
 * @returns {Map<string, string>|null}
 */
export function takeProxyHeadersContext() {
    return proxyHeadersStorage.getStore()?.headers ?? null;
}
