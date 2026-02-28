# node-fetch

[node-fetch](https://github.com/node-fetch/node-fetch) is a light-weight module that brings the Fetch API to Node.js. This page describes how to use node-fetch with proxies and how to send and receive custom proxy headers.

## Getting Started

### Prerequisites

Install the packages:

```bash
npm install javascript-proxy-headers node-fetch
```

### Quick Example

```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

const response = await proxyFetch('https://httpbin.org/ip', {
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// Access response data
const data = await response.json();
console.log(data);

// Access proxy response headers
console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

## API Reference

### proxyFetch(url, options)

Fetch wrapper with proxy header support.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `url` | `string \| URL` | Target URL |
| `options.proxy` | `string` | Proxy URL (required) |
| `options.proxyHeaders` | `Object` | Headers to send to the proxy |
| `options.onProxyConnect` | `Function` | Callback when CONNECT completes |
| `...fetchOptions` | `Object` | Standard fetch options (method, headers, body, etc.) |

**Returns:** `Promise<ProxyResponse>` - Extended Response with `proxyHeaders` property

**Example:**

```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

const response = await proxyFetch('https://httpbin.org/post', {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'value' })
});
```

### createProxyFetch(options)

Create a fetch function bound to a specific proxy configuration.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.proxy` | `string` | Proxy URL |
| `options.proxyHeaders` | `Object` | Default headers to send to proxy |
| `options.onProxyConnect` | `Function` | Callback when CONNECT completes |

**Returns:** `Function` - Configured fetch function

**Example:**

```javascript
import { createProxyFetch } from 'javascript-proxy-headers/node-fetch';

const fetch = createProxyFetch({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// Use like standard fetch
const response = await fetch('https://httpbin.org/ip');
const data = await response.json();
```

## Accessing Proxy Headers

Unlike other libraries, node-fetch returns proxy headers in a separate `proxyHeaders` property (a `Map`):

```javascript
const response = await proxyFetch('https://httpbin.org/ip', {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// Proxy headers are in response.proxyHeaders (Map)
const proxyIp = response.proxyHeaders.get('x-proxymesh-ip');
const proxyCountry = response.proxyHeaders.get('x-proxymesh-country');

// Target response headers are in response.headers (Headers)
const contentType = response.headers.get('content-type');
```

## Response Methods

The `ProxyResponse` object supports all standard Response methods:

```javascript
const response = await proxyFetch('https://httpbin.org/ip', {
    proxy: 'http://proxy:8080'
});

// Standard properties
console.log(response.ok);        // true/false
console.log(response.status);    // 200
console.log(response.statusText);// "OK"
console.log(response.url);       // final URL after redirects

// Body methods
const text = await response.text();
const json = await response.json();
const blob = await response.blob();
const buffer = await response.arrayBuffer();

// Clone
const clone = response.clone();
```

## POST, PUT, and Other Methods

```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

const proxyOptions = {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
};

// POST with JSON
const r1 = await proxyFetch('https://httpbin.org/post', {
    ...proxyOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'value' })
});

// PUT
const r2 = await proxyFetch('https://httpbin.org/put', {
    ...proxyOptions,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'updated' })
});

// DELETE
const r3 = await proxyFetch('https://httpbin.org/delete', {
    ...proxyOptions,
    method: 'DELETE'
});
```

## Error Handling

```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

try {
    const response = await proxyFetch('https://httpbin.org/ip', {
        proxy: 'http://proxy:8080',
        proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
    });

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
} catch (error) {
    if (error.name === 'ConnectError') {
        // Proxy CONNECT failed
        console.error('Proxy error:', error.statusCode, error.statusMessage);
    } else {
        console.error('Error:', error.message);
    }
}
```

## Using with Existing Code

```javascript
// Before (standard node-fetch with https-proxy-agent)
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const agent = new HttpsProxyAgent('http://proxy:8080');
const response = await fetch('https://api.example.com', { agent });

// After (with proxy headers)
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

const response = await proxyFetch('https://api.example.com', {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});
// Now you can access response.proxyHeaders!
```
