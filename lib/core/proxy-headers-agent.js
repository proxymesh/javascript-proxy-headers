/**
 * ProxyHeadersAgent - HTTP Agent that supports custom proxy headers.
 *
 * This agent sends custom headers during the HTTPS CONNECT handshake
 * and captures the proxy's response headers.
 */

import { Agent } from 'https';
import net from 'net';
import tls from 'tls';
import { parseProxyUrl, buildConnectRequest } from './utils.js';
import { parseConnectResponse, hasCompleteHeaders, ConnectError } from './connect-parser.js';

export class ProxyHeadersAgent extends Agent {
    /**
     * Create a new ProxyHeadersAgent.
     *
     * @param {string|URL} proxy - Proxy URL (e.g., 'http://user:pass@proxy:8080')
     * @param {Object} options - Agent options
     * @param {Object} options.proxyHeaders - Headers to send to the proxy
     * @param {Function} options.onProxyConnect - Callback when CONNECT completes: (headers) => void
     * @param {number} options.proxyTimeout - Timeout for proxy CONNECT (ms), default 30000
     * @param {Object} options.tlsOptions - TLS options for target connection
     */
    constructor(proxy, options = {}) {
        super(options);

        const proxyInfo = parseProxyUrl(proxy);
        this.proxyHost = proxyInfo.host;
        this.proxyPort = proxyInfo.port;
        this.proxyAuth = proxyInfo.auth;
        this.proxyProtocol = proxyInfo.protocol;

        this.proxyHeaders = options.proxyHeaders || {};
        this.onProxyConnect = options.onProxyConnect || null;
        this.proxyTimeout = options.proxyTimeout || 30000;
        this.tlsOptions = options.tlsOptions || {};

        this.lastProxyHeaders = null;
    }

    /**
     * Create a connection through the proxy.
     * @param {Object} options - Connection options
     * @param {Function} callback - Callback with (err, socket)
     */
    createConnection(options, callback) {
        const targetHost = options.host || options.hostname;
        const targetPort = options.port || 443;

        const proxySocket = net.connect({
            host: this.proxyHost,
            port: this.proxyPort,
        });

        let buffer = Buffer.alloc(0);
        let connected = false;
        let timeoutId = null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            proxySocket.removeAllListeners('data');
            proxySocket.removeAllListeners('error');
            proxySocket.removeAllListeners('close');
        };

        const handleError = (err) => {
            cleanup();
            if (!connected) {
                proxySocket.destroy();
                callback(err);
            }
        };

        timeoutId = setTimeout(() => {
            handleError(new Error(`Proxy CONNECT timeout after ${this.proxyTimeout}ms`));
        }, this.proxyTimeout);

        proxySocket.on('error', handleError);

        proxySocket.on('close', () => {
            if (!connected) {
                handleError(new Error('Proxy connection closed unexpectedly'));
            }
        });

        proxySocket.on('connect', () => {
            const connectRequest = buildConnectRequest(
                targetHost,
                targetPort,
                this.proxyAuth,
                this.proxyHeaders
            );

            proxySocket.write(connectRequest);
        });

        proxySocket.on('data', (data) => {
            buffer = Buffer.concat([buffer, data]);

            if (!hasCompleteHeaders(buffer)) {
                return;
            }

            const response = parseConnectResponse(buffer);

            if (!response) {
                handleError(new Error('Invalid CONNECT response from proxy'));
                return;
            }

            cleanup();

            this.lastProxyHeaders = response.headers;

            if (this.onProxyConnect) {
                try {
                    this.onProxyConnect(response.headers);
                } catch (e) {
                    // Ignore callback errors
                }
            }

            if (response.statusCode !== 200) {
                const err = new ConnectError(
                    `Proxy CONNECT failed: ${response.statusCode} ${response.statusMessage}`,
                    response.statusCode,
                    response.statusMessage,
                    response.headers
                );
                proxySocket.destroy();
                callback(err);
                return;
            }

            connected = true;

            const tlsSocket = tls.connect({
                socket: proxySocket,
                servername: targetHost,
                ...this.tlsOptions,
            });

            tlsSocket.on('error', (err) => {
                callback(err);
            });

            tlsSocket.on('secureConnect', () => {
                callback(null, tlsSocket);
            });
        });

        return proxySocket;
    }
}

export { ConnectError };
