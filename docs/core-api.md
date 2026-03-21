# Core API

The core API provides low-level access to proxy header functionality. Use this when you need direct control or when integrating with libraries not directly supported.

## ProxyHeadersAgent

The `ProxyHeadersAgent` class extends Node.js's `https.Agent` to support custom proxy headers.

### Import

```javascript
import { ProxyHeadersAgent } from 'javascript-proxy-headers';
```

### Constructor

```javascript
new ProxyHeadersAgent(proxy, options)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `proxy` | `string \| URL` | Proxy URL (e.g., `http://user:pass@proxy:8080`) |
| `options.proxyHeaders` | `Object` | Headers to send to the proxy |
| `options.onProxyConnect` | `Function` | Callback when CONNECT completes: `(headers: Map) => void` |
| `options.proxyTimeout` | `number` | Timeout for proxy CONNECT in ms (default: 30000) |
| `options.tlsOptions` | `Object` | TLS options for target connection |

### Example

```javascript
import { ProxyHeadersAgent } from 'javascript-proxy-headers';
import https from 'https';

const agent = new ProxyHeadersAgent('http://proxy.example.com:8080', {
    proxyHeaders: {
        'X-ProxyMesh-Country': 'US',
        'X-ProxyMesh-Session': 'my-session'
    },
    onProxyConnect: (headers) => {
        console.log('Connected via:', headers.get('x-proxymesh-ip'));
    },
    proxyTimeout: 30000
});

const req = https.request({
    hostname: 'httpbin.org',
    path: '/ip',
    method: 'GET',
    agent
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log(body);
        console.log('Last proxy headers:', agent.lastProxyHeaders);
    });
});

req.end();
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `proxyHost` | `string` | Proxy hostname |
| `proxyPort` | `number` | Proxy port |
| `proxyAuth` | `string \| null` | Base64-encoded proxy auth |
| `proxyHeaders` | `Object` | Headers to send to proxy |
| `lastProxyHeaders` | `Map \| null` | Headers from last CONNECT response |

## ConnectError

Error thrown when the proxy CONNECT request fails.

### Import

```javascript
import { ConnectError } from 'javascript-proxy-headers';
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Always `'ConnectError'` |
| `message` | `string` | Error message |
| `statusCode` | `number` | HTTP status code from proxy |
| `statusMessage` | `string` | HTTP status message from proxy |
| `proxyHeaders` | `Map` | Headers from proxy response |

### Example

```javascript
import { ProxyHeadersAgent, ConnectError } from 'javascript-proxy-headers';
import https from 'https';

const agent = new ProxyHeadersAgent('http://proxy:8080', {
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const req = https.request({
    hostname: 'httpbin.org',
    path: '/ip',
    agent
}, (res) => {
    // Handle response
});

req.on('error', (error) => {
    if (error instanceof ConnectError) {
        console.error('Proxy CONNECT failed:', error.statusCode);
        console.error('Proxy said:', error.statusMessage);
        console.error('Proxy headers:', error.proxyHeaders);
    } else {
        console.error('Request failed:', error.message);
    }
});

req.end();
```

## Utility Functions

### parseProxyUrl(proxyUrl)

Parse a proxy URL into components.

```javascript
import { parseProxyUrl } from 'javascript-proxy-headers';

const { host, port, auth, protocol } = parseProxyUrl('http://user:pass@proxy:8080');
// { host: 'proxy', port: 8080, auth: 'dXNlcjpwYXNz', protocol: 'http:' }
```

### parseTargetUrl(targetUrl)

Parse a target URL for CONNECT request.

```javascript
import { parseTargetUrl } from 'javascript-proxy-headers';

const { host, port } = parseTargetUrl('https://example.com:8443/path');
// { host: 'example.com', port: 8443 }
```

### buildConnectRequest(targetHost, targetPort, proxyAuth, proxyHeaders)

Build an HTTP CONNECT request string.

```javascript
import { buildConnectRequest } from 'javascript-proxy-headers';

const request = buildConnectRequest(
    'example.com',
    443,
    'dXNlcjpwYXNz',
    { 'X-ProxyMesh-Country': 'US' }
);
// CONNECT example.com:443 HTTP/1.1
// Host: example.com:443
// Proxy-Authorization: Basic dXNlcjpwYXNz
// X-ProxyMesh-Country: US
```

### parseConnectResponse(data)

Parse an HTTP CONNECT response.

```javascript
import { parseConnectResponse } from 'javascript-proxy-headers';

const response = parseConnectResponse(buffer);
// {
//   statusCode: 200,
//   statusMessage: 'Connection Established',
//   headers: Map { 'x-proxymesh-ip' => '1.2.3.4' },
//   bodyStart: 45
// }
```

## Using with Other Libraries

The core agent can be used with any library that accepts an `https.Agent`:

### With native fetch (Node.js 18+)

```javascript
import { ProxyHeadersAgent } from 'javascript-proxy-headers';

const agent = new ProxyHeadersAgent('http://proxy:8080', {
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// Note: native fetch doesn't directly accept agent
// Use undici's fetch instead
import { fetch, setGlobalDispatcher, Agent } from 'undici';
// ... custom dispatcher setup needed
```

### With needle

For normal use, prefer the [needle adapter](needle.md) (`proxyNeedleGet` / `createProxyNeedle`), which merges CONNECT headers onto the response. To wire the agent yourself:

```javascript
import { ProxyHeadersAgent } from 'javascript-proxy-headers';
import needle from 'needle';

const agent = new ProxyHeadersAgent('http://proxy:8080', {
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

needle.get('https://httpbin.org/ip', { agent }, (err, resp) => {
    console.log(resp.body);
    console.log(agent.lastProxyHeaders);
});
```

### With http2-wrapper

```javascript
import { ProxyHeadersAgent } from 'javascript-proxy-headers';
import http2 from 'http2-wrapper';

const agent = new ProxyHeadersAgent('http://proxy:8080', {
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// Use for the CONNECT portion, then upgrade to HTTP/2
// Implementation depends on specific requirements
```
