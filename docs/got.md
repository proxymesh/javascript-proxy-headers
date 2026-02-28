# got

[got](https://github.com/sindresorhus/got) is a human-friendly and powerful HTTP request library for Node.js. This page describes how to use got with proxies and how to send and receive custom proxy headers.

## Getting Started

### Prerequisites

Install the packages:

```bash
npm install javascript-proxy-headers got
```

### Quick Example

```javascript
import { createProxyGot } from 'javascript-proxy-headers/got';

const client = await createProxyGot({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client('https://httpbin.org/ip');

// Access response data
console.log(response.body);

// Access proxy response headers (merged into response.headers)
console.log(response.headers['x-proxymesh-ip']);
```

## API Reference

### createProxyGot(options)

Creates a got instance with proxy header support.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.proxy` | `string` | Proxy URL (e.g., `http://user:pass@proxy:8080`) |
| `options.proxyHeaders` | `Object` | Headers to send to the proxy |
| `options.onProxyConnect` | `Function` | Callback when CONNECT completes |
| `options.gotOptions` | `Object` | Additional got instance options |

**Returns:** `Promise<Got>` - Configured got instance

**Example:**

```javascript
import { createProxyGot } from 'javascript-proxy-headers/got';

const client = await createProxyGot({
    proxy: 'http://proxy:8080',
    proxyHeaders: {
        'X-ProxyMesh-Country': 'US',
        'X-ProxyMesh-Session': 'my-session'
    },
    gotOptions: {
        timeout: { request: 30000 },
        headers: { 'User-Agent': 'MyApp/1.0' }
    }
});
```

### Convenience Functions

```javascript
import { proxyGet, proxyPost } from 'javascript-proxy-headers/got';

// GET request
const response = await proxyGet('https://httpbin.org/ip', {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// POST request
const response = await proxyPost('https://httpbin.org/post', {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    gotOptions: {
        json: { key: 'value' }
    }
});
```

## Accessing Proxy Headers

Proxy response headers are merged into `response.headers` and also available via `response.proxyHeaders`:

```javascript
const response = await client('https://httpbin.org/ip');

// Merged into response.headers
const proxyIp = response.headers['x-proxymesh-ip'];

// Also available separately
const proxyHeaders = response.proxyHeaders; // Map
```

## All Request Methods

```javascript
const client = await createProxyGot({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// GET (default)
const r1 = await client('https://api.example.com/data');

// POST
const r2 = await client.post('https://api.example.com/data', {
    json: { key: 'value' }
});

// PUT
const r3 = await client.put('https://api.example.com/data/1', {
    json: { key: 'updated' }
});

// DELETE
const r4 = await client.delete('https://api.example.com/data/1');

// PATCH
const r5 = await client.patch('https://api.example.com/data/1', {
    json: { key: 'patched' }
});
```

## Got Features

The proxy-enabled client retains all got features:

### JSON Mode

```javascript
const client = await createProxyGot({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    gotOptions: {
        responseType: 'json'
    }
});

const response = await client('https://httpbin.org/ip');
console.log(response.body.origin); // Already parsed JSON
```

### Timeouts

```javascript
const client = await createProxyGot({
    proxy: 'http://proxy:8080',
    gotOptions: {
        timeout: {
            lookup: 1000,
            connect: 5000,
            request: 30000
        }
    }
});
```

### Retry

```javascript
const client = await createProxyGot({
    proxy: 'http://proxy:8080',
    gotOptions: {
        retry: {
            limit: 3,
            statusCodes: [408, 429, 500, 502, 503, 504]
        }
    }
});
```

### Hooks

```javascript
const client = await createProxyGot({
    proxy: 'http://proxy:8080',
    gotOptions: {
        hooks: {
            beforeRequest: [
                options => {
                    console.log('Making request to:', options.url.href);
                }
            ],
            afterResponse: [
                response => {
                    console.log('Got response:', response.statusCode);
                    return response;
                }
            ]
        }
    }
});
```

## Error Handling

```javascript
import { createProxyGot } from 'javascript-proxy-headers/got';

const client = await createProxyGot({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

try {
    const response = await client('https://httpbin.org/ip');
    console.log(response.body);
} catch (error) {
    if (error.name === 'ConnectError') {
        console.error('Proxy error:', error.statusCode);
    } else if (error.response) {
        console.error('Server error:', error.response.statusCode);
    } else {
        console.error('Request error:', error.message);
    }
}
```
