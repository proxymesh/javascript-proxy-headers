# JavaScript Proxy Headers

Extensions for JavaScript HTTP libraries to support **sending and receiving custom proxy headers** during HTTPS CONNECT tunneling.

## The Problem

When making HTTPS requests through a proxy, the connection is established via a CONNECT tunnel. During this process:

1. **Sending headers to the proxy** - Most JavaScript HTTP libraries don't provide a way to send custom headers (like `X-ProxyMesh-Country`) to the proxy server during the CONNECT handshake.

2. **Receiving headers from the proxy** - The proxy's response headers from the CONNECT request are typically discarded, making it impossible to read custom headers (like `X-ProxyMesh-IP`) that the proxy sends back.

This library solves both problems for popular JavaScript HTTP libraries.

## Supported Libraries

| Library | Module | Use Case |
|---------|--------|----------|
| [axios](https://axios-http.com/) | `axios-proxy` | Most popular HTTP client |
| [node-fetch](https://github.com/node-fetch/node-fetch) | `node-fetch-proxy` | Fetch API for Node.js |
| [got](https://github.com/sindresorhus/got) | `got-proxy` | Human-friendly HTTP client |
| [undici](https://undici.nodejs.org/) | `undici-proxy` | Fast HTTP client (Node.js core) |
| [superagent](https://github.com/ladjs/superagent) | `superagent-proxy` | Flexible HTTP client |

## Installation

```bash
npm install javascript-proxy-headers
```

Then install the HTTP library you want to use (e.g., `npm install axios`).

> **Note:** This package has no dependencies by default - install only what you need.

## Quick Start

### axios

```javascript
import { createProxyAxios } from 'javascript-proxy-headers/axios';

const client = createProxyAxios({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client.get('https://httpbin.org/ip');

// Proxy headers are merged into response.headers
console.log(response.headers['x-proxymesh-ip']);
```

### node-fetch

```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

const response = await proxyFetch('https://httpbin.org/ip', {
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// Proxy headers available on response
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

### got

```javascript
import { createProxyGot } from 'javascript-proxy-headers/got';

const client = createProxyGot({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client('https://httpbin.org/ip');
console.log(response.headers['x-proxymesh-ip']);
```

### undici

```javascript
import { request } from 'javascript-proxy-headers/undici';

const { statusCode, headers, body, proxyHeaders } = await request(
    'https://httpbin.org/ip',
    {
        proxy: 'http://user:pass@proxy.example.com:8080',
        proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
    }
);

console.log(proxyHeaders.get('x-proxymesh-ip'));
```

### Core Agent (Advanced)

For direct control, use the core `ProxyHeadersAgent`:

```javascript
import { ProxyHeadersAgent } from 'javascript-proxy-headers';
import https from 'https';

const agent = new ProxyHeadersAgent('http://proxy.example.com:8080', {
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    onProxyConnect: (headers) => {
        console.log('Proxy IP:', headers.get('x-proxymesh-ip'));
    }
});

https.get('https://httpbin.org/ip', { agent }, (res) => {
    // Handle response
});
```

## Testing

A test harness is included to verify proxy header functionality:

```bash
# Set your proxy
export PROXY_URL='http://user:pass@proxy.example.com:8080'

# Test all modules
npm test

# Test specific module
npm test axios
```

## Requirements

- Node.js >= 18.0.0
- One or more supported HTTP libraries

## Related Projects

- **[python-proxy-headers](https://github.com/proxymesh/python-proxy-headers)** - Same functionality for Python
- **[proxy-examples](https://github.com/proxymesh/proxy-examples)** - Example code for using proxies

## About

Created by [ProxyMesh](https://proxymesh.com) to help our customers use custom headers to control proxy behavior. Works with any proxy that supports custom headers.

## License

MIT License
