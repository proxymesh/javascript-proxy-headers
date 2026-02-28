# axios

[axios](https://axios-http.com/) is the most popular HTTP client for JavaScript. This page describes how to use axios with proxies and how to send and receive custom proxy headers.

## Getting Started

### Prerequisites

Install the packages:

```bash
npm install javascript-proxy-headers axios
```

### Quick Example

```javascript
import { createProxyAxios } from 'javascript-proxy-headers/axios';

// Create a configured axios instance
const client = await createProxyAxios({
    proxy: 'http://user:pass@proxy.example.com:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// Make requests
const response = await client.get('https://httpbin.org/ip');

// Access response data
console.log(response.data);

// Access proxy response headers (merged into response.headers)
console.log(response.headers['x-proxymesh-ip']);
```

## API Reference

### createProxyAxios(options)

Creates an axios instance configured with proxy header support.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options.proxy` | `string` | Proxy URL (e.g., `http://user:pass@proxy:8080`) |
| `options.proxyHeaders` | `Object` | Headers to send to the proxy |
| `options.onProxyConnect` | `Function` | Callback when CONNECT completes: `(headers) => void` |
| `options.axiosOptions` | `Object` | Additional axios instance options |

**Returns:** `Promise<AxiosInstance>` - Configured axios instance

**Example:**

```javascript
import { createProxyAxios } from 'javascript-proxy-headers/axios';

const client = await createProxyAxios({
    proxy: 'http://proxy:8080',
    proxyHeaders: {
        'X-ProxyMesh-Country': 'US',
        'X-ProxyMesh-Session': 'my-session'
    },
    onProxyConnect: (headers) => {
        console.log('Connected via:', headers.get('x-proxymesh-ip'));
    },
    axiosOptions: {
        timeout: 30000,
        headers: { 'User-Agent': 'MyApp/1.0' }
    }
});
```

### Convenience Functions

For one-off requests, you can use the convenience functions:

```javascript
import { get, post } from 'javascript-proxy-headers/axios';

// GET request
const response = await get('https://httpbin.org/ip', {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// POST request
const response = await post('https://httpbin.org/post', { key: 'value' }, {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});
```

## Accessing Proxy Headers

Proxy response headers are automatically merged into `response.headers`:

```javascript
const response = await client.get('https://httpbin.org/ip');

// Proxy headers are available in response.headers
const proxyIp = response.headers['x-proxymesh-ip'];
const proxyCountry = response.headers['x-proxymesh-country'];
```

You can also access the underlying agent to get the last proxy headers:

```javascript
const client = await createProxyAxios({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

await client.get('https://httpbin.org/ip');

// Access via the agent
console.log(client.proxyAgent.lastProxyHeaders);
```

## All Request Methods

The created axios instance supports all standard methods:

```javascript
const client = await createProxyAxios({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// GET
const r1 = await client.get('https://api.example.com/data');

// POST
const r2 = await client.post('https://api.example.com/data', { key: 'value' });

// PUT
const r3 = await client.put('https://api.example.com/data/1', { key: 'updated' });

// DELETE
const r4 = await client.delete('https://api.example.com/data/1');

// PATCH
const r5 = await client.patch('https://api.example.com/data/1', { key: 'patched' });

// HEAD
const r6 = await client.head('https://api.example.com/data');
```

## Using with Existing Code

If you have existing axios code, you can create a configured instance and use it as a drop-in replacement:

```javascript
// Before (standard axios)
import axios from 'axios';
const response = await axios.get('https://api.example.com/data');

// After (with proxy headers)
import { createProxyAxios } from 'javascript-proxy-headers/axios';
const axios = await createProxyAxios({
    proxy: process.env.PROXY_URL,
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});
const response = await axios.get('https://api.example.com/data');
```

## Error Handling

```javascript
import { createProxyAxios } from 'javascript-proxy-headers/axios';

const client = await createProxyAxios({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

try {
    const response = await client.get('https://httpbin.org/ip');
    console.log(response.data);
} catch (error) {
    if (error.name === 'ConnectError') {
        // Proxy CONNECT failed
        console.error('Proxy error:', error.statusCode, error.statusMessage);
        console.error('Proxy headers:', error.proxyHeaders);
    } else if (error.response) {
        // Target server error
        console.error('Server error:', error.response.status);
    } else {
        // Network error
        console.error('Network error:', error.message);
    }
}
```
