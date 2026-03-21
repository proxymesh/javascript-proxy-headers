# Testing

This guide explains how to test your proxy header setup and verify that headers are being sent and received correctly.

## Test Harness

The package includes a comprehensive test harness that tests all supported libraries.

### Running Tests

```bash
# Set your proxy URL
export PROXY_URL='http://user:pass@proxy.example.com:8080'

# Run all tests
npm test

# Run with verbose output (shows header values)
npm run test:verbose

# TypeScript harness (same modules)
npm run test:ts

# Typecheck only (no network)
npm run test:types

# Run specific modules
node test/test_proxy_headers.js axios undici

# From repo root (same as npm test)
node run_tests.js -v

# List available modules
node test/test_proxy_headers.js -l
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PROXY_URL` | Proxy URL (required) | - |
| `HTTPS_PROXY` | Fallback proxy URL | - |
| `TEST_URL` | URL to request | `https://httpbin.org/ip` |
| `PROXY_HEADER` | Response header to check | `X-ProxyMesh-IP` |
| `SEND_PROXY_HEADER` | Header name to send to proxy | - |
| `SEND_PROXY_VALUE` | Header value to send to proxy | - |

### Example Test Run

```bash
export PROXY_URL='http://user:pass@proxy:8080'
export SEND_PROXY_HEADER='X-ProxyMesh-Country'
export SEND_PROXY_VALUE='US'
export PROXY_HEADER='X-ProxyMesh-IP'

npm test
```

Output:
```
============================================================
JavaScript Proxy Headers - Test Harness
============================================================
Proxy URL:       http://user:****@proxy:8080
Test URL:        https://httpbin.org/ip
Check Header:    X-ProxyMesh-IP
Send Header:     X-ProxyMesh-Country: US
Modules:         core, axios, node-fetch, got, undici, superagent, ky, wretch, make-fetch-happen, needle, typed-rest-client
============================================================

Testing core... OK
Testing axios... OK
Testing node-fetch... OK
Testing got... OK
Testing undici... OK
Testing superagent... OK
Testing ky... OK
Testing wretch... OK
Testing make-fetch-happen... OK
Testing needle... OK
Testing typed-rest-client... OK

============================================================
Results
============================================================
[PASS] core
[PASS] axios
[PASS] node-fetch
[PASS] got
[PASS] undici
[PASS] superagent
[PASS] ky
[PASS] wretch
[PASS] make-fetch-happen
[PASS] needle
[PASS] typed-rest-client
============================================================
Passed: 11/11
All tests passed!
```

## Manual Testing

### Quick Verification Script

Create a simple script to verify your setup:

```javascript
// test-proxy.js
import { createProxyAxios } from 'javascript-proxy-headers/axios';

const proxyUrl = process.env.PROXY_URL;
if (!proxyUrl) {
    console.error('Set PROXY_URL environment variable');
    process.exit(1);
}

const client = await createProxyAxios({
    proxy: proxyUrl,
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    onProxyConnect: (headers) => {
        console.log('Proxy CONNECT headers:');
        for (const [name, value] of headers) {
            console.log(`  ${name}: ${value}`);
        }
    }
});

try {
    const response = await client.get('https://httpbin.org/ip');
    console.log('\nResponse:', response.data);
    console.log('Status:', response.status);
} catch (error) {
    console.error('Error:', error.message);
}
```

Run it:
```bash
PROXY_URL='http://user:pass@proxy:8080' node test-proxy.js
```

### Testing with httpbin

[httpbin.org](https://httpbin.org) is useful for testing:

```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

// Test IP - verifies you're going through the proxy
const r1 = await proxyFetch('https://httpbin.org/ip', {
    proxy: process.env.PROXY_URL
});
console.log('IP:', await r1.json());

// Test headers - see what headers reach the target
const r2 = await proxyFetch('https://httpbin.org/headers', {
    proxy: process.env.PROXY_URL,
    headers: { 'X-Custom-Header': 'test' }
});
console.log('Headers:', await r2.json());

// Test POST
const r3 = await proxyFetch('https://httpbin.org/post', {
    proxy: process.env.PROXY_URL,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: true })
});
console.log('POST response:', await r3.json());
```

## Debugging

### Inspect CONNECT Request/Response

Use the `onProxyConnect` callback:

```javascript
const client = await createProxyAxios({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    onProxyConnect: (headers) => {
        console.log('=== PROXY CONNECT RESPONSE ===');
        for (const [name, value] of headers) {
            console.log(`${name}: ${value}`);
        }
        console.log('==============================');
    }
});
```

### Check Last Proxy Headers

After a request, check the agent's `lastProxyHeaders`:

```javascript
const client = await createProxyAxios({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

await client.get('https://httpbin.org/ip');

console.log('Last proxy headers:', client.proxyAgent.lastProxyHeaders);
```

## Common Issues

### "Header not found in response"

The proxy may not be sending the expected header. Check:

1. Is the header name correct (case-insensitive)?
2. Does your proxy support this header?
3. Is the proxy configured to send response headers?

### "Proxy CONNECT timeout"

The proxy is not responding. Check:

1. Is the proxy URL correct?
2. Is the proxy running and accessible?
3. Are credentials correct?
4. Is there a firewall blocking the connection?

### "CONNECT failed: 407 Proxy Authentication Required"

Authentication failed. Check:

1. Are username/password correct?
2. Is the password URL-encoded if it contains special characters?

```javascript
// If password has special chars, encode it
const password = encodeURIComponent('p@ss:word');
const proxy = `http://user:${password}@proxy:8080`;
```

### "Connection refused"

Cannot connect to proxy. Check:

1. Is the proxy hostname/IP correct?
2. Is the port correct?
3. Is the proxy running?

## Testing Different Scenarios

### Country Selection

```javascript
const countries = ['US', 'UK', 'DE', 'JP'];

for (const country of countries) {
    const client = await createProxyAxios({
        proxy: process.env.PROXY_URL,
        proxyHeaders: { 'X-ProxyMesh-Country': country }
    });
    
    const response = await client.get('https://httpbin.org/ip');
    console.log(`${country}: ${response.data.origin}`);
}
```

### Session Persistence

```javascript
const sessionId = 'test-session-123';

const client = await createProxyAxios({
    proxy: process.env.PROXY_URL,
    proxyHeaders: { 'X-ProxyMesh-Session': sessionId }
});

// Multiple requests should use same IP
for (let i = 0; i < 3; i++) {
    const response = await client.get('https://httpbin.org/ip');
    console.log(`Request ${i + 1}: ${response.data.origin}`);
}
```

### Error Handling

```javascript
import { createProxyAxios } from 'javascript-proxy-headers/axios';
import { ConnectError } from 'javascript-proxy-headers';

const client = await createProxyAxios({
    proxy: 'http://invalid-proxy:8080'
});

try {
    await client.get('https://httpbin.org/ip');
} catch (error) {
    if (error instanceof ConnectError) {
        console.log('Proxy error handled correctly');
        console.log('Status:', error.statusCode);
    } else if (error.code === 'ECONNREFUSED') {
        console.log('Connection refused handled correctly');
    } else {
        console.log('Other error:', error.message);
    }
}
```
