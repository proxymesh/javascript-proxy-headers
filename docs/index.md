# JavaScript Proxy Headers

Extensions for JavaScript HTTP libraries to support **sending and receiving custom proxy headers** during HTTPS CONNECT tunneling.

## The Problem

When making HTTPS requests through an HTTP proxy, the connection is established via a CONNECT tunnel:

```
Client → CONNECT request → Proxy → Target Server
         (with headers)      ↓
Client ← CONNECT response ←──┘
         (with headers)
Client ← TLS Tunnel → Proxy ← TLS → Target Server
```

The problem is twofold:

1. **Sending headers to the proxy** - Most JavaScript HTTP libraries don't provide a way to send custom headers (like `X-ProxyMesh-Country`) to the proxy server during the CONNECT handshake.

2. **Receiving headers from the proxy** - The proxy's response headers from the CONNECT request are typically discarded, making it impossible to read custom headers (like `X-ProxyMesh-IP`) that the proxy sends back.

This library solves both problems for popular JavaScript HTTP libraries.

## Supported Libraries

| Library | Module | Use Case |
|---------|--------|----------|
| [axios](axios.md) | `javascript-proxy-headers/axios` | Most popular HTTP client |
| [node-fetch](node-fetch.md) | `javascript-proxy-headers/node-fetch` | Fetch API for Node.js |
| [got](got.md) | `javascript-proxy-headers/got` | Human-friendly HTTP client |
| [undici](undici.md) | `javascript-proxy-headers/undici` | Fast HTTP client (Node.js core) |
| [superagent](superagent.md) | `javascript-proxy-headers/superagent` | Flexible HTTP client |
| [ky](ky.md) | `javascript-proxy-headers/ky` | Tiny fetch wrapper (via node-fetch + agent) |
| [wretch](wretch.md) | `javascript-proxy-headers/wretch` | Fetch wrapper (global fetch polyfill) |
| [make-fetch-happen](make-fetch-happen.md) | `javascript-proxy-headers/make-fetch-happen` | npm-style fetch (cache, retries, proxy) |
| [needle](needle.md) | `javascript-proxy-headers/needle` | Lean HTTP client |
| [typed-rest-client](typed-rest-client.md) | `javascript-proxy-headers/typed-rest-client` | Azure / DevOps–style REST client |

## Quick Start

### Installation

```bash
npm install javascript-proxy-headers
```

Then install the HTTP library you want to use:

```bash
npm install axios  # or node-fetch, got, undici, superagent, ky, wretch, …
```

!!! note
    This package has no dependencies by default - install only what you need.

### Basic Example (axios)

```javascript
import { createProxyAxios } from 'javascript-proxy-headers/axios';

const client = await createProxyAxios({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client.get('https://httpbin.org/ip');

// Proxy headers are merged into response.headers
console.log(response.headers['x-proxymesh-ip']);
```

See the [Getting Started](getting-started.md) guide for more examples.

## Purpose

We at [ProxyMesh](https://proxymesh.com) created these extension modules to support our customers that use JavaScript/Node.js and want to use custom headers to control proxy behavior. But these modules work with any proxy that supports custom headers.

## Related Projects

- **[python-proxy-headers](https://github.com/proxymesh/python-proxy-headers)** - Same functionality for Python
- **[proxy-examples](https://github.com/proxymesh/proxy-examples)** - Example code for using proxies
- **[scrapy-proxy-headers](https://github.com/proxymesh/scrapy-proxy-headers)** - Proxy header support for Scrapy

## Requirements

- Node.js >= 18.0.0
- One or more supported HTTP libraries

## License

MIT License - see [LICENSE](https://github.com/proxymesh/javascript-proxy-headers/blob/main/LICENSE) for details.
