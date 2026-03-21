# wretch

[wretch](https://github.com/elbywan/wretch) is a tiny wrapper around `fetch`. This package configures wretch’s global fetch polyfill to use the same proxy-header-aware `fetch` as [node-fetch](node-fetch.md) (`node-fetch` + `ProxyHeadersAgent`).

## Getting Started

### Prerequisites

```bash
npm install javascript-proxy-headers wretch node-fetch
```

### Quick Example

```javascript
import { createProxyWretch } from 'javascript-proxy-headers/wretch';

const wretch = await createProxyWretch({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

const response = await wretch('https://httpbin.org/ip').get().res();
const data = await response.json();

console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

## API Reference

### createProxyWretch(options)

Loads wretch, builds a proxy-header `fetch` via `createProxyFetch`, and calls `wretch.polyfills({ fetch })`. Returns the default wretch factory so you can chain `.get()`, `.post()`, `.res()`, etc.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.proxy` | `string` | Proxy URL |
| `options.proxyHeaders` | `Object` | Headers to send on CONNECT |
| `options.onProxyConnect` | `Function` | CONNECT callback: `(headers: Map) => void` |

**Returns:** `Promise<Wretch>` — the default wretch export after polyfills are applied

**Example:**

```javascript
import { createProxyWretch } from 'javascript-proxy-headers/wretch';

const wretch = await createProxyWretch({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    onProxyConnect: (headers) => {
        console.log('Proxy IP:', headers.get('x-proxymesh-ip'));
    },
});

await wretch('https://httpbin.org/ip').get().res();
```

## Important: Global Polyfills

wretch stores fetch polyfills on a module singleton. **Avoid mixing different proxy URLs or `proxyHeaders` in the same process** unless you coordinate calls to `createProxyWretch` (each invocation overwrites the polyfill). For multiple isolated configs, prefer separate processes or a fetch-based client that does not rely on wretch globals (for example [ky](ky.md) or [node-fetch](node-fetch.md) directly).

## Accessing Proxy Headers

The resolved `Response` from `.res()` is a [`ProxyResponse`](node-fetch.md): use `response.proxyHeaders.get('header-name')`.
