# make-fetch-happen

[make-fetch-happen](https://github.com/npm/make-fetch-happen) is npm’s fetch implementation (caching, retries, proxy integration). This package supplies a `ProxyHeadersAgent` as the `agent` option so `@npmcli/agent` uses it as-is, and wraps the returned `Response` so CONNECT response headers are available.

## Getting Started

### Prerequisites

```bash
npm install javascript-proxy-headers make-fetch-happen
```

### Quick Example

```javascript
import { createProxyMakeFetchHappen } from 'javascript-proxy-headers/make-fetch-happen';

const fetch = createProxyMakeFetchHappen({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

const response = await fetch('https://httpbin.org/ip');
const data = await response.json();

console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

## API Reference

### createProxyMakeFetchHappen(options)

Builds `make-fetch-happen` with a `ProxyHeadersAgent`, then wraps the fetch so each response includes `proxyHeaders` from the last CONNECT.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.proxy` | `string` | Proxy URL (required) |
| `options.proxyHeaders` | `Object` | Headers to send on CONNECT |
| `options.onProxyConnect` | `Function` | CONNECT callback |
| *(other)* | — | Any other properties are forwarded to `make-fetch-happen.defaults()` (for example cache, retry, `agent` is set internally) |

**Returns:** A `fetch` function with:

- `.defaults(url, opts)` — same pattern as make-fetch-happen, still wrapped with `ProxyResponse`
- `.proxyAgent` — the `ProxyHeadersAgent` instance (for example `fetch.proxyAgent.lastProxyHeaders`)

**Example:**

```javascript
import { createProxyMakeFetchHappen } from 'javascript-proxy-headers/make-fetch-happen';

const fetch = createProxyMakeFetchHappen({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    onProxyConnect: (h) => console.log(h.get('x-proxymesh-ip')),
});

const scoped = fetch.defaults('https://api.example.com', {
    headers: { Accept: 'application/json' },
});

const res = await scoped('/v1/status');
console.log(res.proxyHeaders.get('x-proxymesh-ip'));
```

## Accessing Proxy Headers

Use `response.proxyHeaders.get('x-proxymesh-ip')` on the wrapped response, or read `fetch.proxyAgent.lastProxyHeaders` after a request.

## Synchronous Factory

Unlike some adapters, `createProxyMakeFetchHappen` is **not** async: it returns the wrapped fetch immediately.
