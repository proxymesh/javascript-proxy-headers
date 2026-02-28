# undici

[undici](https://undici.nodejs.org/) is a fast HTTP/1.1 client from the Node.js core team. It powers the native `fetch` in Node.js 18+. This page describes how to use undici with proxies and how to send and receive custom proxy headers.

## Getting Started

### Prerequisites

Install the packages:

```bash
npm install javascript-proxy-headers undici
```

### Quick Example

```javascript
import { request } from 'javascript-proxy-headers/undici';

const { statusCode, body, proxyHeaders } = await request(
    'https://httpbin.org/ip',
    {
        proxy: 'http://user:pass@proxy.example.com:8080',
        proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
    }
);

// Access response data
const data = await body.json();
console.log(data);

// Access proxy response headers
console.log(proxyHeaders.get('x-proxymesh-ip'));
```

## API Reference

### request(url, options)

Make an HTTP request through a proxy with custom headers.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `url` | `string \| URL` | Target URL |
| `options.proxy` | `string` | Proxy URL (required) |
| `options.proxyHeaders` | `Object` | Headers to send to the proxy |
| `options.method` | `string` | HTTP method (default: 'GET') |
| `options.headers` | `Object` | Request headers |
| `options.body` | `*` | Request body |

**Returns:** `Promise<{ statusCode, headers, body, proxyHeaders }>` - Response object

**Example:**

```javascript
import { request } from 'javascript-proxy-headers/undici';

const { statusCode, headers, body, proxyHeaders } = await request(
    'https://httpbin.org/post',
    {
        proxy: 'http://proxy:8080',
        proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' })
    }
);

const data = await body.json();
console.log(data);
```

### get(url, options)

Convenience function for GET requests.

```javascript
import { get } from 'javascript-proxy-headers/undici';

const { statusCode, body, proxyHeaders } = await get('https://httpbin.org/ip', {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});
```

### post(url, options)

Convenience function for POST requests.

```javascript
import { post } from 'javascript-proxy-headers/undici';

const { statusCode, body } = await post('https://httpbin.org/post', {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'value' })
});
```

## Response Object

The response object contains:

| Property | Type | Description |
|----------|------|-------------|
| `statusCode` | `number` | HTTP status code |
| `headers` | `Object` | Response headers from target server |
| `body` | `Readable` | Response body stream |
| `proxyHeaders` | `Map<string, string>` | Headers from proxy CONNECT response |

### Reading the Body

```javascript
const { body } = await request('https://httpbin.org/ip', {
    proxy: 'http://proxy:8080'
});

// As text
const text = await body.text();

// As JSON
const json = await body.json();

// As buffer
const buffer = await body.arrayBuffer();
```

## Accessing Proxy Headers

Proxy headers are returned separately in the `proxyHeaders` Map:

```javascript
const { proxyHeaders } = await request('https://httpbin.org/ip', {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

// Access individual headers (case-insensitive)
const proxyIp = proxyHeaders.get('x-proxymesh-ip');
const proxyCountry = proxyHeaders.get('x-proxymesh-country');

// Iterate over all proxy headers
for (const [name, value] of proxyHeaders) {
    console.log(`${name}: ${value}`);
}
```

## HTTP Methods

```javascript
import { request } from 'javascript-proxy-headers/undici';

const proxyOptions = {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
};

// GET
const r1 = await request('https://api.example.com/data', {
    ...proxyOptions,
    method: 'GET'
});

// POST
const r2 = await request('https://api.example.com/data', {
    ...proxyOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'value' })
});

// PUT
const r3 = await request('https://api.example.com/data/1', {
    ...proxyOptions,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'updated' })
});

// DELETE
const r4 = await request('https://api.example.com/data/1', {
    ...proxyOptions,
    method: 'DELETE'
});
```

## Error Handling

```javascript
import { request, ConnectError } from 'javascript-proxy-headers/undici';

try {
    const { statusCode, body, proxyHeaders } = await request(
        'https://httpbin.org/ip',
        {
            proxy: 'http://proxy:8080',
            proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
        }
    );

    const data = await body.json();
    console.log(data);
} catch (error) {
    if (error instanceof ConnectError) {
        // Proxy CONNECT failed
        console.error('Proxy error:', error.statusCode, error.statusMessage);
        console.error('Proxy headers:', error.proxyHeaders);
    } else {
        console.error('Error:', error.message);
    }
}
```

## Why undici?

undici is a good choice when:

- You need maximum performance (it's the fastest Node.js HTTP client)
- You're already using Node.js 18+ native fetch
- You want low-level control over requests
- You need streaming support

The proxy extension maintains undici's performance characteristics while adding proxy header support.
