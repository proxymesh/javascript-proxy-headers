# ky

[ky](https://github.com/sindresorhus/ky) is a small HTTP client built on `fetch`. This package wires ky to a custom `fetch` implemented with [node-fetch](node-fetch.md) and `ProxyHeadersAgent`, so CONNECT proxy headers work the same way as in the node-fetch adapter.

## Getting Started

### Prerequisites

```bash
npm install javascript-proxy-headers ky node-fetch
```

`node-fetch` is required because the underlying `fetch` is shared with the node-fetch integration.

### Quick Example

```javascript
import { createProxyKy } from 'javascript-proxy-headers/ky';

const api = await createProxyKy({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

const response = await api('https://httpbin.org/ip');
const data = await response.json();

// CONNECT response headers (ProxyResponse)
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

## API Reference

### createProxyKy(options)

Creates a ky instance (`ky.create`) whose `fetch` sends custom headers on the proxy CONNECT and surfaces CONNECT response headers on each `Response` as `proxyHeaders`.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.proxy` | `string` | Proxy URL (e.g. `http://user:pass@proxy:8080`) |
| `options.proxyHeaders` | `Object` | Headers to send to the proxy on CONNECT |
| `options.onProxyConnect` | `Function` | Called when CONNECT completes: `(headers: Map) => void` |
| `options.kyOptions` | `Object` | Passed to `ky.create()` (prefixUrl, timeout, hooks, etc.) |

**Returns:** `Promise<KyInstance>`

**Example:**

```javascript
import { createProxyKy } from 'javascript-proxy-headers/ky';

const api = await createProxyKy({
    proxy: 'http://proxy:8080',
    proxyHeaders: {
        'X-ProxyMesh-Country': 'US',
        'X-ProxyMesh-Session': 'my-session',
    },
    onProxyConnect: (headers) => {
        console.log('CONNECT headers:', headers.get('x-proxymesh-ip'));
    },
    kyOptions: {
        prefixUrl: 'https://api.example.com',
        timeout: 30000,
    },
});

const res = await api.get('v1/status').json();
```

## Accessing Proxy Headers

Responses are [`ProxyResponse`](node-fetch.md) instances: use `response.proxyHeaders.get('x-proxymesh-ip')` (and the usual `response.json()`, `response.text()`, etc.). Proxy CONNECT failures use the same errors as the underlying fetch stack; see [Core API](core-api.md) for `ConnectError` on the agent.
