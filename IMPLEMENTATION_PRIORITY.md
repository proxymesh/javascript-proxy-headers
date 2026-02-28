# Implementation Priority & Plan

This document outlines the implementation plan for javascript-proxy-headers.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    javascript-proxy-headers                  │
├─────────────────────────────────────────────────────────────┤
│  Library Wrappers (high-level, user-friendly APIs)          │
│  ┌─────────┐ ┌───────────┐ ┌─────┐ ┌────────┐ ┌──────────┐ │
│  │  axios  │ │node-fetch │ │ got │ │ undici │ │superagent│ │
│  └────┬────┘ └─────┬─────┘ └──┬──┘ └────┬───┘ └────┬─────┘ │
│       │            │          │         │          │        │
│       └────────────┴────┬─────┴─────────┴──────────┘        │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐    │
│  │              ProxyHeadersAgent (core)                │    │
│  │  - Manages CONNECT request with custom headers       │    │
│  │  - Captures CONNECT response headers                 │    │
│  │  - Compatible with http.Agent interface              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Agent (Week 1)
**Goal:** Create `ProxyHeadersAgent` - the foundation for all library wrappers

**Files:**
- `lib/core/proxy-headers-agent.js` - Main agent implementation
- `lib/core/connect-parser.js` - HTTP CONNECT response parser
- `lib/core/utils.js` - Shared utilities

**Features:**
- [x] Parse proxy URL (host, port, auth)
- [x] Send custom headers in CONNECT request
- [x] Parse CONNECT response headers
- [x] Support Basic auth
- [x] Expose headers via callback or property
- [x] Compatible with Node.js `http.Agent` interface

**API:**
```javascript
import { ProxyHeadersAgent } from 'javascript-proxy-headers';

const agent = new ProxyHeadersAgent('http://proxy:8080', {
    proxyHeaders: {
        'X-ProxyMesh-Country': 'US'
    }
});

// After request, headers available on agent
console.log(agent.lastProxyHeaders); // Map of response headers
```

---

### Phase 2: Undici Extension (Week 1-2)
**Goal:** Native undici support with cleanest API

**Files:**
- `lib/undici-proxy.js`

**Features:**
- [ ] Custom `ProxyAgent` subclass or wrapper
- [ ] Support `proxyHeaders` option
- [ ] Expose CONNECT response headers on response
- [ ] Support async header callback

**API:**
```javascript
import { request } from 'javascript-proxy-headers/undici';

const { statusCode, headers, body, proxyHeaders } = await request(url, {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

console.log(proxyHeaders.get('x-proxymesh-ip'));
```

---

### Phase 3: node-fetch Extension (Week 2)
**Goal:** Drop-in fetch wrapper with proxy header support

**Files:**
- `lib/node-fetch-proxy.js`

**Features:**
- [ ] Wrapper function around fetch
- [ ] Uses ProxyHeadersAgent internally
- [ ] Extends Response to include proxyHeaders

**API:**
```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

const response = await proxyFetch(url, {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

console.log(response.proxyHeaders.get('x-proxymesh-ip'));
```

---

### Phase 4: Axios Extension (Week 2-3)
**Goal:** Axios adapter with proxy header support

**Files:**
- `lib/axios-proxy.js`

**Features:**
- [ ] Custom axios instance factory
- [ ] Request interceptor for agent setup
- [ ] Response interceptor to merge headers
- [ ] Support both sync and async access

**API:**
```javascript
import { createProxyAxios } from 'javascript-proxy-headers/axios';

const client = createProxyAxios({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client.get(url);
console.log(response.headers['x-proxymesh-ip']); // Merged into response
```

---

### Phase 5: Got Extension (Week 3)
**Goal:** Got instance with proxy header support

**Files:**
- `lib/got-proxy.js`

**Features:**
- [ ] Use got.extend() for clean integration
- [ ] Leverage got's hook system
- [ ] Merge proxy headers into response

**API:**
```javascript
import { createProxyGot } from 'javascript-proxy-headers/got';

const client = createProxyGot({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await client(url);
console.log(response.headers['x-proxymesh-ip']);
```

---

### Phase 6: SuperAgent Extension (Week 3-4)
**Goal:** SuperAgent plugin for proxy headers

**Files:**
- `lib/superagent-proxy.js`

**Features:**
- [ ] Plugin function for superagent
- [ ] Chainable API

**API:**
```javascript
import superagent from 'superagent';
import { proxyPlugin } from 'javascript-proxy-headers/superagent';

const response = await superagent
    .get(url)
    .use(proxyPlugin({
        proxy: 'http://proxy:8080',
        proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
    }));

console.log(response.headers['x-proxymesh-ip']);
```

---

## Technical Challenges

### 1. CONNECT Response Timing
The CONNECT response is received before the TLS handshake. Need to:
- Buffer the response
- Parse headers before upgrading to TLS
- Store headers for later retrieval

### 2. Connection Pooling
When using keep-alive/connection pooling:
- Each new CONNECT will have different proxy headers
- Need to track which response corresponds to which request
- Consider disabling pooling for simplicity initially

### 3. Async Header Access
Proxy headers are available before the target response:
- Option 1: Callback when CONNECT completes
- Option 2: Property on agent, accessed after request
- Option 3: Merge into final response headers

### 4. TypeScript Support
- Provide `.d.ts` files for all modules
- Extend existing library types properly

---

## File Structure

```
javascript-proxy-headers/
├── package.json
├── README.md
├── LIBRARY_RESEARCH.md
├── IMPLEMENTATION_PRIORITY.md
├── index.js                    # Main entry point
├── lib/
│   ├── core/
│   │   ├── proxy-headers-agent.js
│   │   ├── connect-parser.js
│   │   └── utils.js
│   ├── axios-proxy.js
│   ├── node-fetch-proxy.js
│   ├── got-proxy.js
│   ├── undici-proxy.js
│   └── superagent-proxy.js
├── test/
│   ├── run_tests.js
│   ├── core.test.js
│   ├── axios.test.js
│   ├── node-fetch.test.js
│   ├── got.test.js
│   ├── undici.test.js
│   └── superagent.test.js
└── types/
    └── index.d.ts
```

---

## Success Criteria

1. **Core Agent**: Can send headers in CONNECT, receive headers from response
2. **All Libraries**: Consistent API pattern across all wrappers
3. **Tests**: Each library tested with real proxy
4. **Documentation**: Clear examples for each library
5. **TypeScript**: Full type definitions

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Node.js internals change | Pin minimum Node version, test across versions |
| Library API changes | Use peer dependencies with version ranges |
| Connection pooling complexity | Start without pooling, add later |
| Performance overhead | Benchmark against direct connections |

---

*Plan created: February 28, 2026*
