# JavaScript Proxy Headers

Extensions for JavaScript HTTP libraries to support **sending and receiving custom proxy headers** during HTTPS CONNECT tunneling.

## The Problem

When making HTTPS requests through a proxy, the connection is established via a CONNECT tunnel. During this process:

1. **Sending headers to the proxy** - Most JavaScript HTTP libraries don't provide a way to send custom headers (like `X-ProxyMesh-Country`) to the proxy server during the CONNECT handshake.

2. **Receiving headers from the proxy** - The proxy's response headers from the CONNECT request are typically discarded, making it impossible to read custom headers (like `X-ProxyMesh-IP`) that the proxy sends back.

This library solves both problems for popular JavaScript HTTP libraries.

## Supported Libraries

| Library | Subpath export | Notes |
|---------|----------------|--------|
| [axios](https://axios-http.com/) | `javascript-proxy-headers/axios` | Widely used client |
| [node-fetch](https://github.com/node-fetch/node-fetch) | `javascript-proxy-headers/node-fetch` | Fetch API on Node |
| [got](https://github.com/sindresorhus/got) | `javascript-proxy-headers/got` | Ergonomic API |
| [undici](https://undici.nodejs.org/) | `javascript-proxy-headers/undici` | Node’s fast HTTP stack |
| [superagent](https://github.com/ladjs/superagent) | `javascript-proxy-headers/superagent` | Chaining API |
| [ky](https://github.com/sindresorhus/ky) | `javascript-proxy-headers/ky` | Tiny fetch wrapper |
| [wretch](https://github.com/elbywan/wretch) | `javascript-proxy-headers/wretch` | Fetch wrapper (sets wretch’s global fetch polyfill) |
| [make-fetch-happen](https://github.com/npm/make-fetch-happen) | `javascript-proxy-headers/make-fetch-happen` | npm-style fetch (cache, retries, proxy) |
| [needle](https://github.com/tomas/needle) | `javascript-proxy-headers/needle` | Lean HTTP client |
| [typed-rest-client](https://github.com/microsoft/typed-rest-client) | `javascript-proxy-headers/typed-rest-client` | Azure / DevOps–style REST client |

**urllib** is not integrated yet: it expects an [undici](https://undici.nodejs.org/) `Dispatcher`, not a Node `Agent`. See `notes/urllib-integration-deferred.md` in this repo for a possible approach.

## Installation

```bash
npm install javascript-proxy-headers
```

Then install the HTTP client(s) you use (for example `axios`, `got`, `ky`, `wretch`, `make-fetch-happen`, `needle`, or `typed-rest-client`). Each is an optional peer dependency.

> **Note:** This package has no runtime dependencies by default—install only the adapters you need.

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

### ky

Uses a custom `fetch` built from node-fetch + `ProxyHeadersAgent` (`ky.create({ fetch })`).

```javascript
import { createProxyKy } from 'javascript-proxy-headers/ky';

const api = await createProxyKy({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await api('https://httpbin.org/ip');
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

### wretch

Registers the same custom `fetch` as wretch’s fetch polyfill. Use the normal wretch chain (for example `.get().res()`).

```javascript
import { createProxyWretch } from 'javascript-proxy-headers/wretch';

const wretch = await createProxyWretch({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await wretch('https://httpbin.org/ip').get().res();
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

### make-fetch-happen

Passes a `ProxyHeadersAgent` as `agent`; `@npmcli/agent` uses it as-is when set.

```javascript
import { createProxyMakeFetchHappen } from 'javascript-proxy-headers/make-fetch-happen';

const fetch = createProxyMakeFetchHappen({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await fetch('https://httpbin.org/ip');
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

### needle

```javascript
import { proxyNeedleGet } from 'javascript-proxy-headers/needle';

const res = await proxyNeedleGet('https://httpbin.org/ip', {
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// CONNECT response headers merged onto res.headers where missing
console.log(res.headers['x-proxymesh-ip']);
```

### typed-rest-client

Uses a subclass of `HttpClient` that routes HTTPS through `ProxyHeadersAgent` (no `tunnel` agent).

```javascript
import { createProxyRestClient } from 'javascript-proxy-headers/typed-rest-client';

const client = createProxyRestClient({
    userAgent: 'my-app',
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

await client.get('https://httpbin.org/ip');
console.log(client.proxyAgent.lastProxyHeaders?.get('x-proxymesh-ip'));
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

Integration tests need a real proxy (set `PROXY_URL` or `HTTPS_PROXY`):

```bash
export PROXY_URL='http://user:pass@proxy.example.com:8080'

npm test                              # all adapters (see package.json "test")
node run_tests.js -v                  # same harness from repo root
npm run test:ts                       # same checks via tsx + TypeScript harness
npm run test:types                    # `tsc --noEmit` only (no network)

# Limit modules
node test/test_proxy_headers.js -v axios ky
```

Verbose (`-v`) prints captured header values. See `test/test_proxy_headers.js --help`.

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
