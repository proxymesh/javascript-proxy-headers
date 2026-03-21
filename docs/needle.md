# needle

[needle](https://github.com/tomas/needle) is a lean HTTP client for Node. This package routes HTTPS through `ProxyHeadersAgent` and merges CONNECT response headers into the needle response where the same keys are not already set.

## Getting Started

### Prerequisites

```bash
npm install javascript-proxy-headers needle
```

### Quick Example

```javascript
import { proxyNeedleGet } from 'javascript-proxy-headers/needle';

const res = await proxyNeedleGet('https://httpbin.org/ip', {
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

console.log(res.body);
// CONNECT headers merged into res.headers when missing
console.log(res.headers['x-proxymesh-ip']);
console.log(res.proxyAgent.lastProxyHeaders);
```

## API Reference

### proxyNeedleGet(url, options)

Promise-based GET with proxy headers. Needle’s proxy handling is disabled (`proxy: null`, `use_proxy_from_env_var: false`) so only `ProxyHeadersAgent` is used.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `url` | `string` | Target URL (HTTPS recommended) |
| `options.proxy` | `string` | Proxy URL (required) |
| `options.proxyHeaders` | `Object` | CONNECT headers |
| `options.onProxyConnect` | `Function` | CONNECT callback |
| `options.needleOptions` | `Object` | Extra options passed to `needle.get` |

**Returns:** `Promise<NeedleResponse>` with `proxyAgent` set to the agent used.

### createProxyNeedle(options)

Returns a small helper bound to one proxy configuration:

**Returns:** `{ get(url, opts?), proxyAgent }`

- `get` — same behavior as `proxyNeedleGet` but merges `needleOptions` from `createProxyNeedle` with per-call `opts`.
- `proxyAgent` — shared `ProxyHeadersAgent`.

```javascript
import { createProxyNeedle } from 'javascript-proxy-headers/needle';

const { get, proxyAgent } = createProxyNeedle({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    needleOptions: { compressed: true },
});

const res = await get('https://httpbin.org/ip');
```

## Accessing Proxy Headers

Prefer `res.headers['x-proxymesh-ip']` after merge, or `res.proxyAgent.lastProxyHeaders` for the raw `Map` from the last CONNECT.

## Core Agent

You can also pass `ProxyHeadersAgent` to needle yourself; see [Core API](core-api.md).
