/**
 * Utility functions for proxy header handling.
 */

import net from 'node:net';
import tls from 'node:tls';

const INVALID_HEADER_CHAR = /[\r\n\0]/;

/**
 * Validate that a header name does not contain characters that could
 * enable CRLF injection in raw HTTP protocol strings.
 * @param {string} name - Header name
 * @throws {TypeError} If the name contains CR, LF, or NUL
 */
export function validateHeaderName(name) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new TypeError('Header name must be a non-empty string');
    }
    if (INVALID_HEADER_CHAR.test(name)) {
        throw new TypeError(
            `Invalid character in header name: ${JSON.stringify(name.slice(0, 50))}`
        );
    }
}

/**
 * Validate that a header value does not contain characters that could
 * enable CRLF injection in raw HTTP protocol strings.
 * @param {string} value - Header value
 * @throws {TypeError} If the value contains CR, LF, or NUL
 */
export function validateHeaderValue(value) {
    const str = String(value);
    if (INVALID_HEADER_CHAR.test(str)) {
        throw new TypeError(
            `Invalid character in header value: ${JSON.stringify(str.slice(0, 50))}`
        );
    }
}

/**
 * Parse a proxy URL into components.
 * @param {string|URL} proxyUrl - The proxy URL
 * @returns {{ host: string, port: number, auth: string|null, protocol: string }}
 */
export function parseProxyUrl(proxyUrl) {
    const url = typeof proxyUrl === 'string' ? new URL(proxyUrl) : proxyUrl;
    
    const host = url.hostname;
    const port = parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 8080);
    const protocol = url.protocol;
    
    let auth = null;
    if (url.username) {
        const username = decodeURIComponent(url.username);
        const password = url.password ? decodeURIComponent(url.password) : '';
        auth = Buffer.from(`${username}:${password}`).toString('base64');
    }
    
    return { host, port, auth, protocol };
}

/**
 * Parse a target URL for the CONNECT request.
 * @param {string|URL} targetUrl - The target URL
 * @returns {{ host: string, port: number }}
 */
export function parseTargetUrl(targetUrl) {
    const url = typeof targetUrl === 'string' ? new URL(targetUrl) : targetUrl;
    
    const host = url.hostname;
    const port = parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 80);
    
    return { host, port };
}

/**
 * Open a TCP or TLS socket to the proxy.
 * HTTPS proxy URLs use tls.connect so Proxy-Authorization is not sent in the clear.
 * @param {{ host: string, port: number, protocol: string }} proxyInfo
 * @param {import('node:tls').ConnectionOptions} [proxyTlsOptions]
 * @returns {import('node:net').Socket|import('node:tls').TLSSocket}
 */
export function createProxySocket(proxyInfo, proxyTlsOptions = {}) {
    if (proxyInfo.protocol === 'https:') {
        const tlsOpts = {
            host: proxyInfo.host,
            port: proxyInfo.port,
            ...proxyTlsOptions,
        };
        if (!net.isIP(proxyInfo.host) && tlsOpts.servername === undefined) {
            tlsOpts.servername = proxyInfo.host;
        }
        return tls.connect(tlsOpts);
    }
    return net.connect({
        host: proxyInfo.host,
        port: proxyInfo.port,
    });
}

/**
 * Event that fires when the proxy socket is ready to write CONNECT.
 * For HTTPS proxies this is secureConnect (after the TLS handshake).
 * @param {string} protocol
 * @returns {'secureConnect'|'connect'}
 */
export function proxyReadyEvent(protocol) {
    return protocol === 'https:' ? 'secureConnect' : 'connect';
}

/**
 * Build the CONNECT request string.
 * @param {string} targetHost - Target hostname
 * @param {number} targetPort - Target port
 * @param {string|null} proxyAuth - Base64 encoded proxy auth
 * @param {Object} proxyHeaders - Custom headers to send to proxy
 * @returns {string}
 */
export function buildConnectRequest(targetHost, targetPort, proxyAuth, proxyHeaders = {}) {
    if (typeof targetHost !== 'string' || targetHost.length === 0) {
        throw new TypeError('Target host must be a non-empty string');
    }
    if (INVALID_HEADER_CHAR.test(targetHost)) {
        throw new TypeError(
            `Invalid character in target host: ${JSON.stringify(targetHost.slice(0, 50))}`
        );
    }

    const port = Number(targetPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new TypeError(
            `Invalid target port: ${JSON.stringify(String(targetPort).slice(0, 50))}`
        );
    }

    const lines = [
        `CONNECT ${targetHost}:${port} HTTP/1.1`,
        `Host: ${targetHost}:${port}`,
    ];
    
    if (proxyAuth) {
        lines.push(`Proxy-Authorization: Basic ${proxyAuth}`);
    }
    
    const entries = proxyHeaders instanceof Map
        ? [...proxyHeaders.entries()]
        : Object.entries(proxyHeaders || {});
    for (const [key, value] of entries) {
        validateHeaderName(key);
        validateHeaderValue(value);
        lines.push(`${key}: ${value}`);
    }
    
    lines.push('', '');
    return lines.join('\r\n');
}

/**
 * Normalize header name to lowercase.
 * @param {string} name - Header name
 * @returns {string}
 */
export function normalizeHeaderName(name) {
    return name.toLowerCase();
}
