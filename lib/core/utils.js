/**
 * Utility functions for proxy header handling.
 */

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
 * Build the CONNECT request string.
 * @param {string} targetHost - Target hostname
 * @param {number} targetPort - Target port
 * @param {string|null} proxyAuth - Base64 encoded proxy auth
 * @param {Object} proxyHeaders - Custom headers to send to proxy
 * @returns {string}
 */
export function buildConnectRequest(targetHost, targetPort, proxyAuth, proxyHeaders = {}) {
    const lines = [
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1`,
        `Host: ${targetHost}:${targetPort}`,
    ];
    
    if (proxyAuth) {
        lines.push(`Proxy-Authorization: Basic ${proxyAuth}`);
    }
    
    for (const [key, value] of Object.entries(proxyHeaders)) {
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
