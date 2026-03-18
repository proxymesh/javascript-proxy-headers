#!/usr/bin/env node
/**
 * TypeScript test harness for javascript-proxy-headers extensions.
 *
 * Mirrors `test/test_proxy_headers.js`, but is authored in TS so we can
 * typecheck the public API and keep the runtime behavior identical.
 */

type HeaderBag = Map<string, string> | Record<string, unknown> | null | undefined;

class TestConfig {
  proxyUrl: string | undefined;
  testUrl: string;
  proxyHeader: string;
  sendProxyHeader: string | null;
  sendProxyValue: string | null;

  constructor() {
    this.proxyUrl = process.env.PROXY_URL || process.env.HTTPS_PROXY || process.env.https_proxy;
    this.testUrl = process.env.TEST_URL || "https://httpbin.org/ip";
    this.proxyHeader = process.env.PROXY_HEADER || "X-ProxyMesh-IP";
    this.sendProxyHeader = process.env.SEND_PROXY_HEADER || null;
    this.sendProxyValue = process.env.SEND_PROXY_VALUE || null;
  }

  get proxyHeadersToSend(): Record<string, string> {
    if (this.sendProxyHeader && this.sendProxyValue) {
      return { [this.sendProxyHeader]: this.sendProxyValue };
    }
    return {};
  }

  validate() {
    if (!this.proxyUrl) {
      throw new Error("No proxy URL configured. Set PROXY_URL or HTTPS_PROXY environment variable.");
    }
  }
}

class TestResult {
  moduleName: string;
  success: boolean;
  headerValue: string | null;
  error: string | null;
  responseStatus: number | null;

  constructor(
    moduleName: string,
    success: boolean,
    headerValue: string | null = null,
    error: string | null = null,
    responseStatus: number | null = null,
  ) {
    this.moduleName = moduleName;
    this.success = success;
    this.headerValue = headerValue;
    this.error = error;
    this.responseStatus = responseStatus;
  }

  format(verbose = false) {
    if (this.success) {
      if (verbose && this.headerValue) return `[PASS] ${this.moduleName}: ${this.headerValue}`;
      return `[PASS] ${this.moduleName}`;
    }
    return `[FAIL] ${this.moduleName}: ${this.error}`;
  }
}

function checkHeader(headers: HeaderBag, headerName: string): string | null {
  const headerLower = headerName.toLowerCase();

  if (headers instanceof Map) {
    for (const [key, value] of headers) {
      if (key.toLowerCase() === headerLower) return value;
    }
    return null;
  }

  if (headers && typeof headers === "object") {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === headerLower) return value == null ? null : String(value);
    }
  }

  return null;
}

function validateSentHeaderValue(config: TestConfig, headerValue: string | null): string | null {
  if (!config.sendProxyHeader || !config.sendProxyValue) return null;
  if (config.proxyHeader.toLowerCase() !== config.sendProxyHeader.toLowerCase()) return null;
  const expected = String(config.sendProxyValue).trim();
  const actual = headerValue ? String(headerValue).trim() : "";
  if (actual === expected) return null;
  return `Expected ${config.proxyHeader} to equal ${expected} (sent in request) but got ${actual}`;
}

type TestFn = (config: TestConfig) => Promise<TestResult>;

const AVAILABLE_TESTS: Record<string, TestFn> = {
  async core(config) {
    try {
      const { ProxyHeadersAgent } = await import("../index.js");
      const https = await import("https");

      return await new Promise<TestResult>((resolve) => {
        let capturedHeaders: Map<string, string> | null = null;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const agent = new ProxyHeadersAgent(config.proxyUrl!, {
          proxyHeaders: config.proxyHeadersToSend,
          onProxyConnect: (headers: Map<string, string>) => {
            capturedHeaders = headers;
          },
        });

        const url = new URL(config.testUrl);
        const req = https.request(
          {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: "GET",
            agent,
          },
          (res) => {
            res.on("data", () => {});
            res.on("end", () => {
              const headerValue = capturedHeaders ? checkHeader(capturedHeaders, config.proxyHeader) : null;
              const sentErr = validateSentHeaderValue(config, headerValue);
              if (sentErr) {
                resolve(new TestResult("core", false, null, sentErr, res.statusCode ?? null));
              } else if (headerValue) {
                resolve(new TestResult("core", true, headerValue, null, res.statusCode ?? null));
              } else {
                resolve(
                  new TestResult(
                    "core",
                    false,
                    null,
                    `Header '${config.proxyHeader}' not found in proxy response`,
                    res.statusCode ?? null,
                  ),
                );
              }
            });
          },
        );

        req.on("error", (err: Error) => resolve(new TestResult("core", false, null, err.message)));
        req.end();
      });
    } catch (err) {
      return new TestResult("core", false, null, (err as Error).message);
    }
  },

  async axios(config) {
    try {
      const { createProxyAxios } = await import("../lib/axios-proxy.js");
      const client = await createProxyAxios({
        proxy: config.proxyUrl!,
        proxyHeaders: config.proxyHeadersToSend,
      });

      const response = await client.get(config.testUrl, { validateStatus: () => true });
      const headerValue = checkHeader(response.headers as Record<string, unknown>, config.proxyHeader);

      const sentErr = validateSentHeaderValue(config, headerValue);
      if (sentErr) return new TestResult("axios", false, null, sentErr);
      if (headerValue) return new TestResult("axios", true, headerValue, null, response.status);
      return new TestResult("axios", false, null, `Header '${config.proxyHeader}' not found in response`, response.status);
    } catch (err) {
      return new TestResult("axios", false, null, (err as Error).message);
    }
  },

  async "node-fetch"(config) {
    try {
      const { proxyFetch } = await import("../lib/node-fetch-proxy.js");
      const response = await proxyFetch(config.testUrl, {
        proxy: config.proxyUrl!,
        proxyHeaders: config.proxyHeadersToSend,
      });

      const headerValue = checkHeader(response.proxyHeaders as Map<string, string>, config.proxyHeader);
      const sentErr = validateSentHeaderValue(config, headerValue);
      if (sentErr) return new TestResult("node-fetch", false, null, sentErr);
      if (headerValue) return new TestResult("node-fetch", true, headerValue, null, response.status);
      return new TestResult(
        "node-fetch",
        false,
        null,
        `Header '${config.proxyHeader}' not found in proxy response`,
        response.status,
      );
    } catch (err) {
      return new TestResult("node-fetch", false, null, (err as Error).message);
    }
  },

  async got(config) {
    try {
      const { createProxyGot } = await import("../lib/got-proxy.js");
      const client = await createProxyGot({
        proxy: config.proxyUrl!,
        proxyHeaders: config.proxyHeadersToSend,
        gotOptions: { throwHttpErrors: false },
      });

      const response = await client(config.testUrl);
      const headerValue = checkHeader(response.headers as Record<string, unknown>, config.proxyHeader);

      const sentErr = validateSentHeaderValue(config, headerValue);
      if (sentErr) return new TestResult("got", false, null, sentErr);
      if (headerValue) return new TestResult("got", true, headerValue, null, response.statusCode);
      return new TestResult("got", false, null, `Header '${config.proxyHeader}' not found in response`, response.statusCode);
    } catch (err) {
      return new TestResult("got", false, null, (err as Error).message);
    }
  },

  async undici(config) {
    try {
      const { request } = await import("../lib/undici-proxy.js");
      const { statusCode, proxyHeaders } = await request(config.testUrl, {
        proxy: config.proxyUrl!,
        proxyHeaders: config.proxyHeadersToSend,
      });

      const headerValue = checkHeader(proxyHeaders as Map<string, string>, config.proxyHeader);
      const sentErr = validateSentHeaderValue(config, headerValue);
      if (sentErr) return new TestResult("undici", false, null, sentErr);
      if (headerValue) return new TestResult("undici", true, headerValue, null, statusCode);
      return new TestResult(
        "undici",
        false,
        null,
        `Header '${config.proxyHeader}' not found in proxy response`,
        statusCode,
      );
    } catch (err) {
      return new TestResult("undici", false, null, (err as Error).message);
    }
  },

  async superagent(config) {
    try {
      const { createProxySuperagent } = await import("../lib/superagent-proxy.js");
      const client = await createProxySuperagent({
        proxy: config.proxyUrl!,
        proxyHeaders: config.proxyHeadersToSend,
      });

      const response = await client.get(config.testUrl).ok(() => true);
      const headerValue = checkHeader(response.headers as Record<string, unknown>, config.proxyHeader);

      const sentErr = validateSentHeaderValue(config, headerValue);
      if (sentErr) return new TestResult("superagent", false, null, sentErr);
      if (headerValue) return new TestResult("superagent", true, headerValue, null, response.status);
      return new TestResult(
        "superagent",
        false,
        null,
        `Header '${config.proxyHeader}' not found in response`,
        response.status,
      );
    } catch (err) {
      return new TestResult("superagent", false, null, (err as Error).message);
    }
  },
};

function maskPassword(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.password) return url.replace(`:${parsed.password}@`, ":****@");
    return url;
  } catch {
    return url;
  }
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const options = { verbose: false, list: false, help: false, modules: [] as string[] };
  for (const arg of args) {
    if (arg === "-v" || arg === "--verbose") options.verbose = true;
    else if (arg === "-l" || arg === "--list") options.list = true;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (!arg.startsWith("-")) options.modules.push(arg);
  }
  return options;
}

function showHelp() {
  console.log(`
Test harness for javascript-proxy-headers extensions (TypeScript).

Usage:
    tsx test/test_proxy_headers.ts [options] [module1] [module2] ...

Options:
    -v, --verbose    Show proxy header values in results
    -l, --list       List available modules
    -h, --help       Show this help message

Environment Variables:
    PROXY_URL             Proxy URL (required)
    TEST_URL              URL to request (default: https://httpbin.org/ip)
    PROXY_HEADER          Response header to check (default: X-ProxyMesh-IP)
    SEND_PROXY_HEADER     Header name to send to proxy
    SEND_PROXY_VALUE      Header value to send to proxy
`);
}

function listModules() {
  console.log("Available modules:");
  for (const name of Object.keys(AVAILABLE_TESTS)) console.log(`  - ${name}`);
}

async function runTests(testNames: string[], config: TestConfig, verbose: boolean) {
  console.log("=".repeat(60));
  console.log("JavaScript Proxy Headers - Test Harness (TS)");
  console.log("=".repeat(60));
  console.log(`Proxy URL:       ${maskPassword(config.proxyUrl!)}`);
  console.log(`Test URL:        ${config.testUrl}`);
  console.log(`Check Header:    ${config.proxyHeader}`);
  if (config.sendProxyHeader) console.log(`Send Header:     ${config.sendProxyHeader}: ${config.sendProxyValue}`);
  console.log(`Modules:         ${testNames.join(", ")}`);
  console.log("=".repeat(60));
  console.log();

  const results: TestResult[] = [];
  for (const name of testNames) {
    const testFn = AVAILABLE_TESTS[name];
    if (!testFn) {
      results.push(
        new TestResult(name, false, null, `Unknown module. Available: ${Object.keys(AVAILABLE_TESTS).join(", ")}`),
      );
      continue;
    }
    process.stdout.write(`Testing ${name}... `);
    const result = await testFn(config);
    console.log(result.success ? "OK" : "FAILED");
    results.push(result);
  }
  return results;
}

function printResults(results: TestResult[], verbose: boolean) {
  console.log();
  console.log("=".repeat(60));
  console.log("Results");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;
  for (const result of results) {
    console.log(result.format(verbose));
    if (result.success) passed++;
    else failed++;
  }

  console.log("=".repeat(60));
  console.log(`Passed: ${passed}/${results.length}`);
  if (failed > 0) {
    console.log(`Failed: ${failed}/${results.length}`);
    return false;
  }
  console.log("All tests passed!");
  return true;
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.list) {
    listModules();
    process.exit(0);
  }

  const config = new TestConfig();
  try {
    config.validate();
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    console.error("\nSet environment variables:");
    console.error("  export PROXY_URL='http://user:pass@proxy.example.com:8080'");
    console.error("  export TEST_URL='https://httpbin.org/ip'  # optional");
    console.error("  export PROXY_HEADER='X-ProxyMesh-IP'  # optional");
    process.exit(1);
  }

  const testNames = options.modules.length > 0 ? options.modules : Object.keys(AVAILABLE_TESTS);
  const results = await runTests(testNames, config, options.verbose);
  const allPassed = printResults(results, options.verbose);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nUnexpected error: ${(err as Error).message}`);
  console.error((err as Error).stack);
  process.exit(1);
});

