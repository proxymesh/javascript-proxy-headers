# urllib integration (deferred)

`urllib` v4 routes HTTPS through **undici** using a **`Dispatcher`** (`RequestOptions.dispatcher`, `HttpClient#setDispatcher`), not Node’s `http.Agent`. `ProxyHeadersAgent` is an `https.Agent` and cannot be passed as `dispatcher`.

A first-class adapter should:

1. Refactor shared HTTPS CONNECT logic from `lib/undici-proxy.js` into a reusable helper (tunnel + `undici.Client` with `connect: { socket }`).
2. Implement a minimal **undici `Dispatcher`** (or compose `undici.Client`) that performs that tunnel for each request, matching current HTTPS scope.
3. Wire `new HttpClient(...).setDispatcher(proxyDispatcher)` (or per-request `dispatcher`) and merge `proxyHeaders` onto the `HttpClientResponse` surface the same way other adapters do.

Until that exists, consumers can call `javascript-proxy-headers/undici` or use `createProxyFetch` + `urllib`’s fetch path only if they expose a compatible hook (they do not today without a custom dispatcher).
