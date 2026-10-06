# needle

[needle](https://github.com/tomas/needle) is a lean HTTP client for Node. This package routes HTTPS through `ProxyHeadersAgent` and exposes CONNECT response headers on `res.proxyHeaders`.

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
console.log(res.proxyHeaders.get('x-proxymesh-ip'));
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

Use `res.proxyHeaders.get('x-proxymesh-ip')`. CONNECT headers are not merged into origin `res.headers`. `res.proxyAgent.lastProxyHeaders` is a last-write-wins snapshot of the shared agent.

## Core Agent

You can also pass `ProxyHeadersAgent` to needle yourself; see [Core API](core-api.md).
