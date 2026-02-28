# JavaScript Library Proxy Header Support Research

This document analyzes JavaScript/Node.js HTTP and web scraping libraries for their proxy support and potential for javascript-proxy-headers extension modules.

## Executive Summary

After reviewing 15+ JavaScript libraries, **none of them natively support sending custom headers to proxies or receiving proxy response headers** during HTTPS CONNECT tunneling. This is because:

1. Most libraries rely on `https-proxy-agent` or similar packages that don't expose CONNECT headers
2. Browser automation tools (Puppeteer, Playwright) delegate proxy handling to the browser
3. The underlying Node.js `http.Agent` doesn't provide hooks for CONNECT headers
4. Undici has the most promising architecture but still lacks easy access to CONNECT response headers

---

## The Problem

When making HTTPS requests through an HTTP proxy, the connection flow is:

```
Client → HTTP CONNECT request → Proxy → Target Server
         (with proxy headers)      ↓
Client ← CONNECT response ←────────┘
         (with proxy response headers)
Client ← TLS Tunnel → Proxy ← TLS → Target Server
```

The problem is twofold:
1. **Sending headers to proxy**: Need to add custom headers (e.g., `X-ProxyMesh-Country`) to the CONNECT request
2. **Receiving headers from proxy**: Need to read custom headers (e.g., `X-ProxyMesh-IP`) from the CONNECT response

---

## Library Analysis

### 1. axios (107k stars) ⭐ HIGHEST PRIORITY
**GitHub:** https://github.com/axios/axios  
**Weekly Downloads:** ~48 million  
**Description:** Promise-based HTTP client for the browser and Node.js

**Proxy Support:**
- Browser: Uses browser's proxy settings
- Node.js: Requires external agent (typically `https-proxy-agent`)
- No built-in proxy configuration

**Custom Proxy Headers:** ❌ No
- Relies entirely on the provided agent for proxy handling
- No mechanism to inject headers into CONNECT request
- No access to CONNECT response headers

**Extension Feasibility:** ✅ HIGH
- Can create custom agent wrapper that intercepts CONNECT
- Use axios interceptors to merge proxy response headers
- Clean API possible: `axios.get(url, { proxyHeaders: {...} })`

**Technical Approach:**
```javascript
// Create custom ProxyAgent that accepts headers
class ProxyHeaderAgent extends Agent {
    constructor(proxy, proxyHeaders) {
        // Intercept CONNECT, add headers, capture response
    }
}
```

---

### 2. node-fetch (8.8k stars) ⭐ HIGH PRIORITY
**GitHub:** https://github.com/node-fetch/node-fetch  
**Weekly Downloads:** ~38 million  
**Description:** A light-weight module that brings Fetch API to Node.js

**Proxy Support:**
- Requires external agent (`https-proxy-agent`, `node-fetch-native`, etc.)
- Agent passed via `agent` option

**Custom Proxy Headers:** ❌ No
- Depends entirely on the agent implementation
- `https-proxy-agent` doesn't support custom CONNECT headers
- No access to CONNECT response

**Extension Feasibility:** ✅ HIGH
- Create custom agent that wraps proxy connection
- Can expose headers via response object extension
- Simple wrapper function possible

**Technical Approach:**
```javascript
import { proxyFetch } from 'javascript-proxy-headers/node-fetch';

const response = await proxyFetch(url, {
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});
console.log(response.proxyHeaders.get('X-ProxyMesh-IP'));
```

---

### 3. got (14.3k stars) ⭐ HIGH PRIORITY
**GitHub:** https://github.com/sindresorhus/got  
**Weekly Downloads:** ~13 million  
**Description:** Human-friendly and powerful HTTP request library

**Proxy Support:**
- Agent-based (`https-proxy-agent`)
- Has hook system for request/response lifecycle
- Good architecture for extension

**Custom Proxy Headers:** ❌ No
- Agent handles CONNECT internally
- Hooks don't have access to proxy layer

**Extension Feasibility:** ✅ HIGH
- Hook system allows clean integration
- Can create `got.extend()` instance with proxy header support
- Response hooks can merge proxy headers

**Technical Approach:**
```javascript
import { createProxyGot } from 'javascript-proxy-headers/got';

const proxyGot = createProxyGot({
    proxy: 'http://proxy:8080',
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' }
});

const response = await proxyGot(url);
console.log(response.headers['x-proxymesh-ip']);
```

---

### 4. undici (4.4k stars) ⭐ MEDIUM-HIGH PRIORITY
**GitHub:** https://github.com/nodejs/undici  
**Weekly Downloads:** ~17 million  
**Description:** HTTP/1.1 client from Node.js core team (powers native `fetch`)

**Proxy Support:**
- Built-in `ProxyAgent` class
- Most flexible architecture of all libraries
- Supports `requestTls` and other low-level options

**Custom Proxy Headers:** ⚠️ Partial
- `ProxyAgent` accepts `headers` option but unclear if sent during CONNECT
- No obvious way to receive CONNECT response headers
- Internal architecture may support this with modifications

**Extension Feasibility:** ✅ HIGH
- Best architecture for extension
- `ProxyAgent` is well-documented and extensible
- May be able to subclass `ProxyAgent` directly

**Technical Approach:**
```javascript
import { ProxyHeaderAgent } from 'javascript-proxy-headers/undici';

const agent = new ProxyHeaderAgent('http://proxy:8080', {
    proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
    onProxyConnect: (headers) => {
        console.log('Proxy IP:', headers['x-proxymesh-ip']);
    }
});
```

---

### 5. superagent (16.6k stars)
**GitHub:** https://github.com/ladjs/superagent  
**Weekly Downloads:** ~7 million  
**Description:** Ajax for Node.js and browsers

**Proxy Support:**
- Agent-based (`https-proxy-agent`)
- Plugin architecture available

**Custom Proxy Headers:** ❌ No
- Same limitations as other agent-based libraries

**Extension Feasibility:** ⚠️ MEDIUM
- Plugin system could work
- Less modern than other options
- Lower priority due to declining usage

---

### 6. needle (1.6k stars)
**GitHub:** https://github.com/tomas/needle  
**Weekly Downloads:** ~7 million  
**Description:** Nimble, streamable HTTP client

**Proxy Support:**
- Built-in `proxy` option
- Uses internal proxy handling

**Custom Proxy Headers:** ❌ No
- Internal proxy implementation doesn't expose headers
- Would require patching internals

**Extension Feasibility:** ⚠️ MEDIUM
- Could potentially patch the proxy handling code
- Not as clean as agent-based solutions
- Lower priority

---

### 7. https-proxy-agent (4.7k stars) ⭐ KEY DEPENDENCY
**GitHub:** https://github.com/TooTallNate/proxy-agents  
**Weekly Downloads:** ~52 million  
**Description:** HTTP(s) proxy Agent for Node.js

**Custom Proxy Headers:** ❌ No
- Does not support custom CONNECT headers
- Does not expose CONNECT response headers
- This is THE library most others depend on

**Extension Feasibility:** ✅ HIGH - CORE TARGET
- **This is where we should focus**
- Creating an enhanced `https-proxy-agent` that supports headers would benefit ALL libraries
- Could submit upstream PR or create fork/wrapper

**Technical Approach:**
```javascript
// Core implementation - enhanced proxy agent
class ProxyHeadersAgent extends Agent {
    constructor(proxy, options = {}) {
        this.proxyHeaders = options.proxyHeaders || {};
        this.onProxyResponse = options.onProxyResponse;
    }

    connect(req, options) {
        // 1. Create socket to proxy
        // 2. Send CONNECT with custom headers
        // 3. Parse response, call onProxyResponse
        // 4. Return socket for TLS upgrade
    }
}
```

---

### 8. tunnel (2.3k stars)
**GitHub:** https://github.com/koichik/node-tunnel  
**Weekly Downloads:** ~24 million  
**Description:** Node.js HTTP/HTTPS tunneling proxies

**Custom Proxy Headers:** ⚠️ Partial
- Supports `proxyHeaders` option!
- However, does NOT expose CONNECT response headers

**Extension Feasibility:** ✅ HIGH
- Already supports sending headers
- Just need to add response header capture
- Could be base for our implementation

---

### 9. puppeteer (90.2k stars)
**GitHub:** https://github.com/puppeteer/puppeteer  
**Weekly Downloads:** ~3.5 million  
**Description:** Headless Chrome Node.js API

**Proxy Support:**
- `--proxy-server` Chrome flag
- `page.authenticate()` for proxy auth

**Custom Proxy Headers:** ❌ No
- Browser handles CONNECT internally
- No programmatic access to proxy headers

**Extension Feasibility:** ❌ LOW
- Would require Chrome DevTools Protocol extensions that don't exist
- Not practical for this project

---

### 10. playwright (69.5k stars)
**GitHub:** https://github.com/microsoft/playwright  
**Weekly Downloads:** ~3 million  
**Description:** Browser automation library

**Proxy Support:**
- Browser launch option
- Built-in auth support

**Custom Proxy Headers:** ❌ No
- Same browser limitations as Puppeteer

**Extension Feasibility:** ❌ LOW
- Browser-based, not practical

---

### 11. cheerio (28.9k stars)
**GitHub:** https://github.com/cheeriojs/cheerio  
**Description:** Fast, flexible HTML parser

**Proxy Support:**
- N/A - parsing library only
- Depends on external HTTP client

**Extension Feasibility:** N/A
- Not an HTTP library

---

### 12. crawlee (17.4k stars)
**GitHub:** https://github.com/apify/crawlee  
**Description:** Web scraping and browser automation

**Proxy Support:**
- Built-in proxy rotation
- Uses got/undici for HTTP, Playwright for browser

**Custom Proxy Headers:** ❌ No
- Depends on underlying libraries

**Extension Feasibility:** ⚠️ MEDIUM
- Would benefit from our got/undici extensions
- Could create integration middleware

---

### 13. scrape-it (1.1k stars)
**GitHub:** https://github.com/IonicaBizau/scrape-it  
**Description:** Node.js scraper

**Proxy Support:**
- Uses `got` under the hood

**Extension Feasibility:** ⚠️ MEDIUM
- Would benefit from got extension

---

### 14. x-ray (6k stars)
**GitHub:** https://github.com/matthewmueller/x-ray  
**Description:** Web scraper with composable API

**Proxy Support:**
- Pluggable drivers
- Default uses `request` (deprecated)

**Extension Feasibility:** ⚠️ LOW
- Uses deprecated library
- Would need driver rewrite

---

### 15. ky (12.6k stars)
**GitHub:** https://github.com/sindresorhus/ky  
**Description:** Tiny HTTP client based on Fetch

**Proxy Support:**
- Browser: browser proxy
- Node.js: needs fetch polyfill with agent

**Extension Feasibility:** ⚠️ MEDIUM
- Would inherit from our fetch/undici work

---

## Summary Table

| Library | Stars | Downloads/wk | Proxy Headers | Extension Priority |
|---------|-------|--------------|---------------|-------------------|
| axios | 107k | 48M | ❌ | **HIGH** |
| https-proxy-agent | 4.7k | 52M | ❌ | **HIGH (CORE)** |
| node-fetch | 8.8k | 38M | ❌ | **HIGH** |
| tunnel | 2.3k | 24M | ⚠️ Send only | **HIGH** |
| undici | 4.4k | 17M | ⚠️ Partial | **HIGH** |
| got | 14.3k | 13M | ❌ | **HIGH** |
| superagent | 16.6k | 7M | ❌ | MEDIUM |
| needle | 1.6k | 7M | ❌ | LOW |
| puppeteer | 90.2k | 3.5M | ❌ | LOW (browser) |
| playwright | 69.5k | 3M | ❌ | LOW (browser) |
| crawlee | 17.4k | - | ❌ | MEDIUM |
| ky | 12.6k | - | ❌ | LOW |

---

## Key Insights

### 1. Core Dependency Strategy
The `https-proxy-agent` and `tunnel` packages are used by most other libraries. Creating an enhanced version that supports both **sending and receiving** proxy headers would benefit the entire ecosystem.

### 2. Undici is the Future
As Node.js's official HTTP client, undici has the cleanest architecture. It already supports some proxy header features and is the best long-term investment.

### 3. Browser Libraries Not Viable
Puppeteer, Playwright, and browser-based tools cannot support custom proxy headers because the browser handles CONNECT internally.

### 4. Wrapper Functions vs. Agent Replacement
Two approaches:
- **Agent-level**: Create enhanced proxy agents that work with all libraries
- **Library-level**: Create wrapper functions for each library

We should do both: core agent implementation + library-specific wrappers for better DX.

---

## Recommended Implementation Order

1. **Core: ProxyHeadersAgent** - Enhanced proxy agent that supports send + receive
2. **undici extension** - Most modern, cleanest architecture  
3. **node-fetch extension** - High usage, simple API
4. **axios extension** - Highest usage
5. **got extension** - Good architecture, hook support
6. **superagent extension** - Lower priority

---

*Research conducted: February 28, 2026*
