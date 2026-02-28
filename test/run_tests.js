#!/usr/bin/env node
/**
 * Test runner for javascript-proxy-headers.
 *
 * Usage:
 *     export PROXY_URL='http://user:pass@proxy:8080'
 *     node test/run_tests.js              # Run all tests
 *     node test/run_tests.js axios got    # Run specific tests
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const proxyUrl = process.env.PROXY_URL || process.env.HTTPS_PROXY;
if (!proxyUrl) {
    console.error('Error: Set PROXY_URL environment variable');
    process.exit(1);
}

const testUrl = process.env.TEST_URL || 'https://api.ipify.org?format=json';
const proxyHeader = process.env.PROXY_HEADER;
const proxyValue = process.env.PROXY_VALUE;
const responseHeader = process.env.RESPONSE_HEADER;

const proxyHeaders = proxyHeader && proxyValue ? { [proxyHeader]: proxyValue } : {};

const tests = {
    async core() {
        const { ProxyHeadersAgent } = await import('../index.js');
        const https = await import('https');

        return new Promise((resolve, reject) => {
            const agent = new ProxyHeadersAgent(proxyUrl, {
                proxyHeaders,
                onProxyConnect: (headers) => {
                    console.log('  Proxy headers received:', headers.size, 'headers');
                    if (responseHeader) {
                        console.log(`  ${responseHeader}: ${headers.get(responseHeader.toLowerCase())}`);
                    }
                },
            });

            const url = new URL(testUrl);
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
                    console.log(`  Status: ${res.statusCode}`);
                    console.log(`  Body: ${body.slice(0, 100)}`);
                    resolve();
                });
            });

            req.on('error', reject);
            req.end();
        });
    },

    async axios() {
        const { createProxyAxios } = await import('../lib/axios-proxy.js');

        const client = await createProxyAxios({
            proxy: proxyUrl,
            proxyHeaders,
        });

        const response = await client.get(testUrl);
        console.log(`  Status: ${response.status}`);
        console.log(`  Body: ${JSON.stringify(response.data).slice(0, 100)}`);
        if (responseHeader) {
            console.log(`  ${responseHeader}: ${response.headers[responseHeader.toLowerCase()]}`);
        }
    },

    async 'node-fetch'() {
        const { proxyFetch } = await import('../lib/node-fetch-proxy.js');

        const response = await proxyFetch(testUrl, {
            proxy: proxyUrl,
            proxyHeaders,
        });

        console.log(`  Status: ${response.status}`);
        const body = await response.text();
        console.log(`  Body: ${body.slice(0, 100)}`);
        if (responseHeader) {
            console.log(`  ${responseHeader}: ${response.proxyHeaders.get(responseHeader.toLowerCase())}`);
        }
    },

    async got() {
        const { createProxyGot } = await import('../lib/got-proxy.js');

        const client = await createProxyGot({
            proxy: proxyUrl,
            proxyHeaders,
        });

        const response = await client(testUrl);
        console.log(`  Status: ${response.statusCode}`);
        console.log(`  Body: ${response.body.slice(0, 100)}`);
        if (responseHeader) {
            console.log(`  ${responseHeader}: ${response.headers[responseHeader.toLowerCase()]}`);
        }
    },

    async undici() {
        const { request } = await import('../lib/undici-proxy.js');

        const { statusCode, body, proxyHeaders: respProxyHeaders } = await request(testUrl, {
            proxy: proxyUrl,
            proxyHeaders,
        });

        const text = await body.text();
        console.log(`  Status: ${statusCode}`);
        console.log(`  Body: ${text.slice(0, 100)}`);
        if (responseHeader) {
            console.log(`  ${responseHeader}: ${respProxyHeaders.get(responseHeader.toLowerCase())}`);
        }
    },

    async superagent() {
        const { createProxySuperagent } = await import('../lib/superagent-proxy.js');

        const client = await createProxySuperagent({
            proxy: proxyUrl,
            proxyHeaders,
        });

        const response = await client.get(testUrl);
        console.log(`  Status: ${response.status}`);
        console.log(`  Body: ${JSON.stringify(response.body).slice(0, 100)}`);
        if (responseHeader) {
            console.log(`  ${responseHeader}: ${response.headers[responseHeader.toLowerCase()]}`);
        }
    },
};

const args = process.argv.slice(2);
const toRun = args.length > 0
    ? Object.keys(tests).filter(name => args.some(a => name.includes(a)))
    : Object.keys(tests);

console.log(`Running ${toRun.length} test(s)...\n`);
console.log(`Proxy: ${proxyUrl.replace(/:[^:@]+@/, ':***@')}`);
console.log(`Test URL: ${testUrl}\n`);

let passed = 0;
let failed = 0;

for (const name of toRun) {
    console.log(`--- ${name} ---`);
    try {
        await tests[name]();
        console.log('✓ PASSED\n');
        passed++;
    } catch (error) {
        console.log(`✗ FAILED: ${error.message}\n`);
        if (process.env.DEBUG) {
            console.error(error.stack);
        }
        failed++;
    }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
