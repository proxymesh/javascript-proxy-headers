#!/usr/bin/env node
/**
 * Test harness for javascript-proxy-headers extensions.
 *
 * This script tests each module's ability to:
 * 1. Send custom headers to a proxy server
 * 2. Receive and capture proxy response headers
 * 3. Extract the specified header (default: X-ProxyMesh-IP)
 *
 * Configuration via environment variables:
 *     PROXY_URL             - Proxy URL (e.g., http://user:pass@proxy.example.com:8080)
 *     HTTPS_PROXY           - Fallback if PROXY_URL not set
 *     TEST_URL              - URL to request (default: https://httpbin.org/ip)
 *     PROXY_HEADER          - Response header to check for (default: X-ProxyMesh-IP)
 *     SEND_PROXY_HEADER     - Header name to send to proxy (optional)
 *     SEND_PROXY_VALUE      - Header value to send to proxy (optional)
 *
 * Usage:
 *     node test/test_proxy_headers.js [-v] [module1] [module2] ...
 *
 *     # Test all modules
 *     node test/test_proxy_headers.js
 *
 *     # Test specific modules
 *     node test/test_proxy_headers.js axios undici
 *
 *     # Verbose mode - show header values
 *     node test/test_proxy_headers.js -v
 *
 *     # With custom response header to check
 *     PROXY_HEADER=X-Custom-Header node test/test_proxy_headers.js
 *
 *     # Send a custom header to the proxy
 *     SEND_PROXY_HEADER=X-ProxyMesh-Country SEND_PROXY_VALUE=US node test/test_proxy_headers.js
 *
 * Options:
 *     -v, --verbose    Show proxy header values in results
 *     -l, --list       List available modules
 *     -h, --help       Show this help message
 *
 * Exit codes:
 *     0 - All tests passed
 *     1 - One or more tests failed
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// =============================================================================
// Configuration
// =============================================================================

class TestConfig {
    constructor() {
        this.proxyUrl = process.env.PROXY_URL || process.env.HTTPS_PROXY || process.env.https_proxy;
        this.testUrl = process.env.TEST_URL || 'https://httpbin.org/ip';
        this.proxyHeader = process.env.PROXY_HEADER || 'X-ProxyMesh-IP';
        this.sendProxyHeader = process.env.SEND_PROXY_HEADER || null;
        this.sendProxyValue = process.env.SEND_PROXY_VALUE || null;
    }

    get proxyHeadersToSend() {
        if (this.sendProxyHeader && this.sendProxyValue) {
            return { [this.sendProxyHeader]: this.sendProxyValue };
        }
        return {};
    }

    validate() {
        if (!this.proxyUrl) {
            throw new Error(
                'No proxy URL configured. Set PROXY_URL or HTTPS_PROXY environment variable.'
            );
        }
    }
}

// =============================================================================
// Test Result
// =============================================================================

class TestResult {
    constructor(moduleName, success, headerValue = null, error = null, responseStatus = null) {
        this.moduleName = moduleName;
        this.success = success;
        this.headerValue = headerValue;
        this.error = error;
        this.responseStatus = responseStatus;
    }

    format(verbose = false) {
        if (this.success) {
            if (verbose && this.headerValue) {
                return `[PASS] ${this.moduleName}: ${this.headerValue}`;
            }
            return `[PASS] ${this.moduleName}`;
        }
        return `[FAIL] ${this.moduleName}: ${this.error}`;
    }
}

// =============================================================================
// Module Tests
// =============================================================================

function checkHeader(headers, headerName) {
    const headerLower = headerName.toLowerCase();

    if (headers instanceof Map) {
        for (const [key, value] of headers) {
            if (key.toLowerCase() === headerLower) {
                return value;
            }
        }
        return null;
    }

    if (typeof headers === 'object') {
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() === headerLower) {
                return value;
            }
        }
    }

    return null;
}

/**
 * When SEND_PROXY_HEADER and SEND_PROXY_VALUE are set and we're checking the same header,
 * the proxy response must echo that value (e.g. X-ProxyMesh-IP).
 * @returns {string|null} Error message if expectation not met, null if OK or N/A.
 */
function validateSentHeaderValue(config, headerValue) {
    if (!config.sendProxyHeader || !config.sendProxyValue) return null;
    if (config.proxyHeader.toLowerCase() !== config.sendProxyHeader.toLowerCase()) return null;
    const expected = String(config.sendProxyValue).trim();
    const actual = headerValue ? String(headerValue).trim() : '';
    if (actual === expected) return null;
    return `Expected ${config.proxyHeader} to equal ${expected} (sent in request) but got ${actual}`;
}

const AVAILABLE_TESTS = {
    async core(config) {
        try {
            const { ProxyHeadersAgent } = await import('../index.js');
            const https = await import('https');

            return new Promise((resolve) => {
                let capturedHeaders = null;

                const agent = new ProxyHeadersAgent(config.proxyUrl, {
                    proxyHeaders: config.proxyHeadersToSend,
                    onProxyConnect: (headers) => {
                        capturedHeaders = headers;
                    },
                });

                const url = new URL(config.testUrl);
                const req = https.request({
                    hostname: url.hostname,
                    port: url.port || 443,
                    path: url.pathname + url.search,
                    method: 'GET',
                    agent,
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        const headerValue = capturedHeaders
                            ? checkHeader(capturedHeaders, config.proxyHeader)
                            : null;

                        const sentErr = validateSentHeaderValue(config, headerValue);
                        if (sentErr) {
                            resolve(new TestResult('core', false, null, sentErr, res.statusCode));
                        } else if (headerValue) {
                            resolve(new TestResult('core', true, headerValue, null, res.statusCode));
                        } else {
                            resolve(new TestResult('core', false, null,
                                `Header '${config.proxyHeader}' not found in proxy response`,
                                res.statusCode));
                        }
                    });
                });

                req.on('error', (err) => {
                    resolve(new TestResult('core', false, null, err.message));
                });

                req.end();
            });
        } catch (err) {
            return new TestResult('core', false, null, err.message);
        }
    },

    async axios(config) {
        try {
            const { createProxyAxios } = await import('../lib/axios-proxy.js');

            const client = await createProxyAxios({
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
            });

            const response = await client.get(config.testUrl, {
                validateStatus: () => true,
            });
            const headerValue = checkHeader(response.headers, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('axios', false, null, sentErr);
            if (headerValue) {
                return new TestResult('axios', true, headerValue, null, response.status);
            }
            return new TestResult('axios', false, null,
                `Header '${config.proxyHeader}' not found in response`,
                response.status);
        } catch (err) {
            return new TestResult('axios', false, null, err.message);
        }
    },

    async 'node-fetch'(config) {
        try {
            const { proxyFetch } = await import('../lib/node-fetch-proxy.js');

            const response = await proxyFetch(config.testUrl, {
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
            });

            const headerValue = checkHeader(response.proxyHeaders, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('node-fetch', false, null, sentErr);
            if (headerValue) {
                return new TestResult('node-fetch', true, headerValue, null, response.status);
            }
            return new TestResult('node-fetch', false, null,
                `Header '${config.proxyHeader}' not found in proxy response`,
                response.status);
        } catch (err) {
            return new TestResult('node-fetch', false, null, err.message);
        }
    },

    async got(config) {
        try {
            const { createProxyGot } = await import('../lib/got-proxy.js');

            const client = await createProxyGot({
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
                gotOptions: { throwHttpErrors: false },
            });

            const response = await client(config.testUrl);
            const headerValue = checkHeader(response.headers, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('got', false, null, sentErr);
            if (headerValue) {
                return new TestResult('got', true, headerValue, null, response.statusCode);
            }
            return new TestResult('got', false, null,
                `Header '${config.proxyHeader}' not found in response`,
                response.statusCode);
        } catch (err) {
            return new TestResult('got', false, null, err.message);
        }
    },

    async undici(config) {
        try {
            const { request } = await import('../lib/undici-proxy.js');

            const { statusCode, proxyHeaders } = await request(config.testUrl, {
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
            });

            const headerValue = checkHeader(proxyHeaders, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('undici', false, null, sentErr);
            if (headerValue) {
                return new TestResult('undici', true, headerValue, null, statusCode);
            }
            return new TestResult('undici', false, null,
                `Header '${config.proxyHeader}' not found in proxy response`,
                statusCode);
        } catch (err) {
            return new TestResult('undici', false, null, err.message);
        }
    },

    async superagent(config) {
        try {
            const { createProxySuperagent } = await import('../lib/superagent-proxy.js');

            const client = await createProxySuperagent({
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
            });

            const response = await client.get(config.testUrl).ok(() => true);
            const headerValue = checkHeader(response.headers, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('superagent', false, null, sentErr);
            if (headerValue) {
                return new TestResult('superagent', true, headerValue, null, response.status);
            }
            return new TestResult('superagent', false, null,
                `Header '${config.proxyHeader}' not found in response`,
                response.status);
        } catch (err) {
            return new TestResult('superagent', false, null, err.message);
        }
    },

    async ky(config) {
        try {
            const { createProxyKy } = await import('../lib/ky-proxy.js');

            const api = await createProxyKy({
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
            });

            const response = await api(config.testUrl);
            const headerValue = checkHeader(response.proxyHeaders, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('ky', false, null, sentErr);
            if (headerValue) {
                return new TestResult('ky', true, headerValue, null, response.status);
            }
            return new TestResult('ky', false, null,
                `Header '${config.proxyHeader}' not found in proxy response`,
                response.status);
        } catch (err) {
            return new TestResult('ky', false, null, err.message);
        }
    },

    async wretch(config) {
        try {
            const { createProxyWretch } = await import('../lib/wretch-proxy.js');

            const wretch = await createProxyWretch({
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
            });

            const response = await wretch(config.testUrl).get().res();
            const headerValue = checkHeader(response.proxyHeaders, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('wretch', false, null, sentErr);
            if (headerValue) {
                return new TestResult('wretch', true, headerValue, null, response.status);
            }
            return new TestResult('wretch', false, null,
                `Header '${config.proxyHeader}' not found in proxy response`,
                response.status);
        } catch (err) {
            return new TestResult('wretch', false, null, err.message);
        }
    },

    async 'make-fetch-happen'(config) {
        try {
            const { createProxyMakeFetchHappen } = await import('../lib/make-fetch-happen-proxy.js');

            const fetch = createProxyMakeFetchHappen({
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
            });

            const response = await fetch(config.testUrl);
            const headerValue = checkHeader(response.proxyHeaders, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('make-fetch-happen', false, null, sentErr);
            if (headerValue) {
                return new TestResult('make-fetch-happen', true, headerValue, null, response.status);
            }
            return new TestResult('make-fetch-happen', false, null,
                `Header '${config.proxyHeader}' not found in proxy response`,
                response.status);
        } catch (err) {
            return new TestResult('make-fetch-happen', false, null, err.message);
        }
    },

    async needle(config) {
        try {
            const { proxyNeedleGet } = await import('../lib/needle-proxy.js');

            const res = await proxyNeedleGet(config.testUrl, {
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
            });

            const headerValue = checkHeader(res.headers, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('needle', false, null, sentErr);
            if (headerValue) {
                return new TestResult('needle', true, headerValue, null, res.statusCode);
            }
            return new TestResult('needle', false, null,
                `Header '${config.proxyHeader}' not found in response`,
                res.statusCode);
        } catch (err) {
            return new TestResult('needle', false, null, err.message);
        }
    },

    async 'typed-rest-client'(config) {
        try {
            const { createProxyRestClient } = await import('../lib/typed-rest-client-proxy.js');

            const client = createProxyRestClient({
                userAgent: 'javascript-proxy-headers-test',
                proxy: config.proxyUrl,
                proxyHeaders: config.proxyHeadersToSend,
            });

            const result = await client.get(config.testUrl);
            const headerValue = checkHeader(client.proxyAgent.lastProxyHeaders, config.proxyHeader);

            const sentErr = validateSentHeaderValue(config, headerValue);
            if (sentErr) return new TestResult('typed-rest-client', false, null, sentErr);
            if (headerValue) {
                return new TestResult('typed-rest-client', true, headerValue, null, result.statusCode);
            }
            return new TestResult('typed-rest-client', false, null,
                `Header '${config.proxyHeader}' not found in proxy response`,
                result.statusCode);
        } catch (err) {
            return new TestResult('typed-rest-client', false, null, err.message);
        }
    },
};

// =============================================================================
// Main Runner
// =============================================================================

function maskPassword(url) {
    try {
        const parsed = new URL(url);
        if (parsed.password) {
            return url.replace(`:${parsed.password}@`, ':****@');
        }
        return url;
    } catch {
        return url;
    }
}

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        verbose: false,
        list: false,
        help: false,
        modules: [],
    };

    for (const arg of args) {
        if (arg === '-v' || arg === '--verbose') {
            options.verbose = true;
        } else if (arg === '-l' || arg === '--list') {
            options.list = true;
        } else if (arg === '-h' || arg === '--help') {
            options.help = true;
        } else if (!arg.startsWith('-')) {
            options.modules.push(arg);
        }
    }

    return options;
}

function showHelp() {
    console.log(`
Test harness for javascript-proxy-headers extensions.

Usage:
    node test/test_proxy_headers.js [options] [module1] [module2] ...

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

Examples:
    # Test all modules
    PROXY_URL='http://proxy:8080' node test/test_proxy_headers.js

    # Test specific modules with verbose output
    node test/test_proxy_headers.js -v axios undici

    # Send custom header to proxy
    SEND_PROXY_HEADER=X-ProxyMesh-Country SEND_PROXY_VALUE=US node test/test_proxy_headers.js
`);
}

function listModules() {
    console.log('Available modules:');
    for (const name of Object.keys(AVAILABLE_TESTS)) {
        console.log(`  - ${name}`);
    }
}

async function runTests(testNames, config, verbose) {
    console.log('='.repeat(60));
    console.log('JavaScript Proxy Headers - Test Harness');
    console.log('='.repeat(60));
    console.log(`Proxy URL:       ${maskPassword(config.proxyUrl)}`);
    console.log(`Test URL:        ${config.testUrl}`);
    console.log(`Check Header:    ${config.proxyHeader}`);
    if (config.sendProxyHeader) {
        console.log(`Send Header:     ${config.sendProxyHeader}: ${config.sendProxyValue}`);
    }
    console.log(`Modules:         ${testNames.join(', ')}`);
    console.log('='.repeat(60));
    console.log();

    const results = [];

    for (const name of testNames) {
        const testFn = AVAILABLE_TESTS[name];
        if (!testFn) {
            results.push(new TestResult(name, false, null,
                `Unknown module. Available: ${Object.keys(AVAILABLE_TESTS).join(', ')}`));
            continue;
        }

        process.stdout.write(`Testing ${name}... `);
        const result = await testFn(config);
        console.log(result.success ? 'OK' : 'FAILED');
        results.push(result);
    }

    return results;
}

function printResults(results, verbose) {
    console.log();
    console.log('='.repeat(60));
    console.log('Results');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    for (const result of results) {
        console.log(result.format(verbose));
        if (result.success) {
            passed++;
        } else {
            failed++;
        }
    }

    console.log('='.repeat(60));
    console.log(`Passed: ${passed}/${results.length}`);

    if (failed > 0) {
        console.log(`Failed: ${failed}/${results.length}`);
        return false;
    }

    console.log('All tests passed!');
    return true;
}

async function main() {
    const options = parseArgs();

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
        console.error(`Error: ${err.message}`);
        console.error('\nSet environment variables:');
        console.error("  export PROXY_URL='http://user:pass@proxy.example.com:8080'");
        console.error("  export TEST_URL='https://httpbin.org/ip'  # optional");
        console.error("  export PROXY_HEADER='X-ProxyMesh-IP'  # optional");
        process.exit(1);
    }

    const testNames = options.modules.length > 0
        ? options.modules
        : Object.keys(AVAILABLE_TESTS);

    try {
        const results = await runTests(testNames, config, options.verbose);
        const allPassed = printResults(results, options.verbose);
        process.exit(allPassed ? 0 : 1);
    } catch (err) {
        console.error(`\nUnexpected error: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    }
}

main();
