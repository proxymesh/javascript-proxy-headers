# typed-rest-client

[typed-rest-client](https://github.com/microsoft/typed-rest-client) is the HTTP stack used in many Azure DevOps–style tooling. This package provides `createProxyRestClient`, which subclasses `HttpClient` / `RestClient` so **HTTPS** uses `ProxyHeadersAgent` instead of tunnel-agent, preserving custom CONNECT headers.

HTTP URLs still use the base client behavior (no custom CONNECT path for plain HTTP in this integration).

## Getting Started

### Prerequisites

```bash
npm install javascript-proxy-headers typed-rest-client
```

### Quick Example

```javascript
import { createProxyRestClient } from 'javascript-proxy-headers/typed-rest-client';

const client = createProxyRestClient({
    userAgent: 'my-app',
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

const response = await client.get('https://httpbin.org/ip');
// RestClient API: response has statusCode, result, etc.

console.log(client.proxyAgent.lastProxyHeaders?.get('x-proxymesh-ip'));
```

## API Reference

### createProxyRestClient(options)

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.userAgent` | `string` | Required user agent string |
| `options.baseUrl` | `string` | Optional base URL for `RestClient` |
| `options.handlers` | `array` | Optional request handlers |
| `options.requestOptions` | `object` | `IRequestOptions`; any `proxy` field is cleared so the custom agent is used |
| `options.proxy` | `string` | Proxy URL (required) |
| `options.proxyHeaders` | `Object` | CONNECT headers |
| `options.onProxyConnect` | `Function` | CONNECT callback |

**Returns:** A `RestClient` instance with an extra `proxyAgent` property (`ProxyHeadersAgent`) for inspecting the last CONNECT response.

**Example:**

```javascript
import { createProxyRestClient } from 'javascript-proxy-headers/typed-rest-client';

const client = createProxyRestClient({
    userAgent: 'ci-bot/1.0',
    baseUrl: 'https://api.example.com',
    proxy: process.env.HTTPS_PROXY,
    proxyHeaders: { 'X-ProxyMesh-Session': 'abc' },
    onProxyConnect: (h) => console.log(h.get('x-proxymesh-ip')),
});

await client.get('/v1/resource');
console.log(client.proxyAgent.lastProxyHeaders);
```

## Accessing Proxy Headers

Use `client.proxyAgent.lastProxyHeaders` after a request (a `Map`). The typed-rest-client response objects do not merge proxy headers into application response headers the way axios does.

## Factory

`createProxyRestClient` is synchronous (CommonJS `require` of typed-rest-client under the hood).
