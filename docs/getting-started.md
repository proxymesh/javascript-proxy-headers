# Getting Started

This guide will help you get up and running with javascript-proxy-headers.

## Installation

Install the package:

```bash
npm install javascript-proxy-headers
```

Then install the HTTP library you want to use:

```bash
# Choose one or more
npm install axios
npm install node-fetch
npm install got
npm install undici
npm install superagent
npm install ky
npm install wretch
npm install make-fetch-happen
npm install needle
npm install typed-rest-client
```

Use [ky](ky.md) or [wretch](wretch.md) together with `node-fetch` (the adapters build on the same proxy-aware fetch as the node-fetch module).

## Quick Examples

### axios

```javascript
import { createProxyAxios } from 'javascript-proxy-headers/axios';

const client = await createProxyAxios({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client.get('https://httpbin.org/ip');
console.log(response.data);
console.log(response.headers['x-proxymesh-ip']);
```

### node-fetch

```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

const response = await proxyFetch('https://httpbin.org/ip', {
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const data = await response.json();
console.log(data);
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

### got

```javascript
import { createProxyGot } from 'javascript-proxy-headers/got';

const client = await createProxyGot({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client('https://httpbin.org/ip');
console.log(response.body);
console.log(response.headers['x-proxymesh-ip']);
```

### undici

```javascript
import { request } from 'javascript-proxy-headers/undici';

const { statusCode, body, proxyHeaders } = await request(
    'https://httpbin.org/ip',
    {
        proxy: 'http://user:pass@proxy.example.com:8080',
        proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
    }
);

const data = await body.json();
console.log(data);
console.log(proxyHeaders.get('x-proxymesh-ip'));
```

### superagent

```javascript
import { createProxySuperagent } from 'javascript-proxy-headers/superagent';

const client = await createProxySuperagent({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client.get('https://httpbin.org/ip');
console.log(response.body);
console.log(response.headers['x-proxymesh-ip']);
```

### ky

```javascript
import { createProxyKy } from 'javascript-proxy-headers/ky';

const api = await createProxyKy({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

const response = await api('https://httpbin.org/ip');
const data = await response.json();
console.log(data);
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

### wretch

```javascript
import { createProxyWretch } from 'javascript-proxy-headers/wretch';

const wretch = await createProxyWretch({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

const response = await wretch('https://httpbin.org/ip').get().res();
console.log(await response.json());
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

### make-fetch-happen

```javascript
import { createProxyMakeFetchHappen } from 'javascript-proxy-headers/make-fetch-happen';

const fetch = createProxyMakeFetchHappen({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

const response = await fetch('https://httpbin.org/ip');
console.log(await response.json());
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

### needle

```javascript
import { proxyNeedleGet } from 'javascript-proxy-headers/needle';

const res = await proxyNeedleGet('https://httpbin.org/ip', {
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

console.log(res.body);
console.log(res.headers['x-proxymesh-ip']);
```

### typed-rest-client

```javascript
import { createProxyRestClient } from 'javascript-proxy-headers/typed-rest-client';

const client = createProxyRestClient({
    userAgent: 'my-app',
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
});

await client.get('https://httpbin.org/ip');
console.log(client.proxyAgent.lastProxyHeaders?.get('x-proxymesh-ip'));
```

## Understanding Proxy Headers

### Sending Headers to the Proxy

The `proxyHeaders` option allows you to send custom headers to the proxy server during the CONNECT handshake. Common use cases include:

- **Country selection**: `X-ProxyMesh-Country: US`
- **IP targeting**: `X-ProxyMesh-IP: 1.2.3.4`
- **Session management**: `X-ProxyMesh-Session: abc123`

```javascript
const client = await createProxyAxios({
    proxy: 'http://proxy:8080',
    proxyHeaders: {
        'X-ProxyMesh-Country': 'US',
        'X-ProxyMesh-Session': 'my-session-id'
    }
});
```

### Receiving Headers from the Proxy

Proxy response headers from the CONNECT request are captured and made available. The exact method varies by library:

| Library | Access Method |
|---------|---------------|
| axios | `response.headers['header-name']` (merged) |
| node-fetch | `response.proxyHeaders.get('header-name')` |
| got | `response.headers['header-name']` (merged) |
| undici | `proxyHeaders.get('header-name')` |
| superagent | `response.headers['header-name']` (merged) |
| ky / wretch | `response.proxyHeaders.get('header-name')` on the fetch `Response` |
| make-fetch-happen | `response.proxyHeaders.get('header-name')` |
| needle | `res.headers['header-name']` (merged where not already set) |
| typed-rest-client | `client.proxyAgent.lastProxyHeaders.get('header-name')` |

## Proxy Authentication

All examples support authenticated proxies. Include credentials in the proxy URL:

```javascript
const client = await createProxyAxios({
    proxy: 'http://username:password@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});
```

## Using the Core Agent

For advanced use cases, you can use the core `ProxyHeadersAgent` directly with any library that accepts an `https.Agent`:

```javascript
import { ProxyHeadersAgent } from 'javascript-proxy-headers';
import https from 'https';

const agent = new ProxyHeadersAgent('http://proxy:8080', {
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    onProxyConnect: (headers) => {
        console.log('Proxy IP:', headers.get('x-proxymesh-ip'));
    }
});

https.get('https://httpbin.org/ip', { agent }, (res) => {
    // Handle response
});
```

See the [Core API](core-api.md) documentation for more details.

## Next Steps

- Read the library-specific documentation for detailed API reference
- Check out the [Testing](testing.md) guide to verify your setup
- See [proxy-examples](https://github.com/proxymesh/proxy-examples/tree/main/javascript) for more examples
