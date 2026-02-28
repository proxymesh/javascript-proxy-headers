# superagent

[superagent](https://github.com/ladjs/superagent) is a flexible HTTP client for Node.js and browsers with a fluent API. This page describes how to use superagent with proxies and how to send and receive custom proxy headers.

## Getting Started

### Prerequisites

Install the packages:

```bash
npm install javascript-proxy-headers superagent
```

### Quick Example

```javascript
import { createProxySuperagent } from 'javascript-proxy-headers/superagent';

const client = await createProxySuperagent({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client.get('https://httpbin.org/ip');

// Access response data
console.log(response.body);

// Access proxy response headers (merged into response.headers)
console.log(response.headers['x-proxymesh-ip']);
```

## API Reference

### createProxySuperagent(options)

Creates a superagent client with proxy header support.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.proxy` | `string` | Proxy URL (e.g., `http://user:pass@proxy:8080`) |
| `options.proxyHeaders` | `Object` | Headers to send to the proxy |
| `options.onProxyConnect` | `Function` | Callback when CONNECT completes |

**Returns:** `Promise<Object>` - Object with HTTP method functions (get, post, put, delete, patch, head)

**Example:**

```javascript
import { createProxySuperagent } from 'javascript-proxy-headers/superagent';

const client = await createProxySuperagent({
    proxy: 'http://proxy:8080',
    proxyHeaders: {
        'X-ProxyMesh-Country': 'US',
        'X-ProxyMesh-Session': 'my-session'
    }
});

const response = await client.get('https://httpbin.org/ip');
```

### proxyPlugin(options)

Creates a superagent plugin for use with the `.use()` method.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.proxy` | `string` | Proxy URL (required) |
| `options.proxyHeaders` | `Object` | Headers to send to the proxy |
| `options.onProxyConnect` | `Function` | Callback when CONNECT completes |

**Returns:** `Function` - SuperAgent plugin function

**Example:**

```javascript
import superagent from 'superagent';
import { proxyPlugin } from 'javascript-proxy-headers/superagent';

const response = await superagent
    .get('https://httpbin.org/ip')
    .use(proxyPlugin({
        proxy: 'http://proxy:8080',
        proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
    }));

console.log(response.body);
console.log(response.headers['x-proxymesh-ip']);
```

## Accessing Proxy Headers

Proxy response headers are merged into `response.headers` and also available via `response.proxyHeaders`:

```javascript
const response = await client.get('https://httpbin.org/ip');

// Merged into response.headers
const proxyIp = response.headers['x-proxymesh-ip'];

// Also available separately (Map)
const proxyHeaders = response.proxyHeaders;
```

## All Request Methods

```javascript
const client = await createProxySuperagent({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// GET
const r1 = await client.get('https://api.example.com/data');

// POST with JSON
const r2 = await client.post('https://api.example.com/data')
    .send({ key: 'value' });

// PUT
const r3 = await client.put('https://api.example.com/data/1')
    .send({ key: 'updated' });

// DELETE
const r4 = await client.delete('https://api.example.com/data/1');

// PATCH
const r5 = await client.patch('https://api.example.com/data/1')
    .send({ key: 'patched' });

// HEAD
const r6 = await client.head('https://api.example.com/data');
```

## SuperAgent Features

The proxy-enabled client retains all superagent features:

### Chaining

```javascript
const response = await client.post('https://api.example.com/data')
    .set('Content-Type', 'application/json')
    .set('Authorization', 'Bearer token')
    .send({ key: 'value' })
    .timeout({ response: 5000, deadline: 30000 });
```

### Query Parameters

```javascript
const response = await client.get('https://api.example.com/search')
    .query({ q: 'search term' })
    .query({ page: 1 });
```

### Form Data

```javascript
const response = await client.post('https://api.example.com/upload')
    .field('name', 'file.txt')
    .attach('file', '/path/to/file.txt');
```

### Using the Plugin Directly

For more control, use the plugin with standard superagent:

```javascript
import superagent from 'superagent';
import { proxyPlugin } from 'javascript-proxy-headers/superagent';

const plugin = proxyPlugin({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// Apply to individual requests
const r1 = await superagent.get('https://api.example.com')
    .use(plugin);

const r2 = await superagent.post('https://api.example.com')
    .use(plugin)
    .send({ key: 'value' });
```

## Error Handling

```javascript
import { createProxySuperagent } from 'javascript-proxy-headers/superagent';

const client = await createProxySuperagent({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

try {
    const response = await client.get('https://httpbin.org/ip');
    console.log(response.body);
} catch (error) {
    if (error.name === 'ConnectError') {
        console.error('Proxy error:', error.statusCode);
    } else if (error.status) {
        console.error('Server error:', error.status, error.response?.body);
    } else {
        console.error('Request error:', error.message);
    }
}
```
