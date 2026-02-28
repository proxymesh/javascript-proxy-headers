/**
 * JavaScript Proxy Headers
 *
 * Extensions for JavaScript HTTP libraries to support sending and receiving
 * custom proxy headers during HTTPS CONNECT tunneling.
 *
 * @module javascript-proxy-headers
 */

export { ProxyHeadersAgent, ConnectError } from './lib/core/proxy-headers-agent.js';
export { parseProxyUrl, parseTargetUrl, buildConnectRequest } from './lib/core/utils.js';
export { parseConnectResponse, hasCompleteHeaders } from './lib/core/connect-parser.js';
