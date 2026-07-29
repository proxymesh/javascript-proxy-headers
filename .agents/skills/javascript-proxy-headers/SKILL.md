---
name: javascript-proxy-headers
description: >-
  Send and receive custom headers during HTTPS CONNECT tunneling in Node.js.
  Use when integrating proxy headers with axios, node-fetch, got, undici, ky,
  wretch, make-fetch-happen, needle, superagent, or typed-rest-client.
---

# javascript-proxy-headers

Send custom headers to proxies and receive proxy response headers during HTTPS CONNECT tunneling.

## Installation

```bash
npm install javascript-proxy-headers
```

Install your HTTP client as a peer dependency (axios, got, node-fetch, etc.).

## Quick Reference

| Library | Import | Factory |
|---------|--------|---------|
| axios | `javascript-proxy-headers/axios` | `createProxyAxios` |
| node-fetch | `javascript-proxy-headers/node-fetch` | `proxyFetch` |
| got | `javascript-proxy-headers/got` | `createProxyGot` |
| undici | `javascript-proxy-headers/undici` | `request` |
| ky | `javascript-proxy-headers/ky` | `createProxyKy` |
| wretch | `javascript-proxy-headers/wretch` | `createProxyWretch` |
| make-fetch-happen | `javascript-proxy-headers/make-fetch-happen` | `createProxyMakeFetchHappen` |
| needle | `javascript-proxy-headers/needle` | `proxyNeedleGet` |
| superagent | `javascript-proxy-headers/superagent` | `createProxySuperagent` |
| typed-rest-client | `javascript-proxy-headers/typed-rest-client` | `createProxyRestClient` |

## Usage Patterns

### axios

```javascript
import { createProxyAxios } from 'javascript-proxy-headers/axios';

const client = createProxyAxios({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client.get('https://httpbin.org/ip');
console.log(response.headers['x-proxymesh-ip']);
```

### node-fetch

```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

const response = await proxyFetch('https://httpbin.org/ip', {
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

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

### Core Agent (advanced)

For direct control with any Node.js HTTP client:

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

## Proxy Headers

Custom headers sent during CONNECT are proxy-specific. Check your proxy provider's docs.

Example with [ProxyMesh](https://proxymesh.com):

| Header | Direction | Purpose |
|--------|-----------|---------|
| `X-ProxyMesh-Country` | Send | Route through specific country |
| `X-ProxyMesh-IP` | Send/Receive | Request or receive sticky IP |

## Testing

```bash
export PROXY_URL='http://user:pass@proxy.example.com:8080'
npm test
# or specific adapters:
node test/test_proxy_headers.js -v axios got
```
