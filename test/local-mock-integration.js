#!/usr/bin/env node
/**
 * Run the adapter integration harness against a local CONNECT proxy.
 * Fails unless the mock proxy observed CONNECT and tunneled bytes.
 *
 * Usage: node test/local-mock-integration.js [harness args...]
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { makeSelfSignedCert, startConnectProxy, startOrigin } from './mock-connect-proxy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const harness = join(__dirname, 'test_proxy_headers.js');

const cert = makeSelfSignedCert();
const origin = await startOrigin(cert);
const proxy = await startConnectProxy();

const child = spawn(process.execPath, [harness, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: {
        ...process.env,
        PROXY_URL: proxy.url,
        TEST_URL: origin.url,
        PROXY_HEADER: 'X-ProxyMesh-IP',
        NODE_EXTRA_CA_CERTS: cert.certPath,
        // The origin cert is a local test CA via NODE_EXTRA_CA_CERTS.
        // Do not inherit a caller-supplied reject-unauthorized override.
        NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || '1',
    },
});

const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (status) => resolve(status ?? 1));
});

origin.server.close();
proxy.server.close();
cert.cleanup();

if (code !== 0) {
    process.exit(code);
}

const failures = [];
if (proxy.stats.connects < 1) {
    failures.push('mock proxy saw no CONNECT');
}
if (proxy.stats.clientToUp < 1) {
    failures.push('mock proxy tunneled 0 client bytes');
}
if (proxy.stats.upToClient < 1) {
    failures.push('mock proxy tunneled 0 origin bytes');
}
if (failures.length) {
    console.error(`[FAIL] proxy traversal: ${failures.join('; ')}`);
    console.error(proxy.stats);
    process.exit(1);
}

console.log(
    `[PASS] proxy traversal: ${proxy.stats.connects} CONNECT(s), ` +
    `${proxy.stats.clientToUp}B client->origin, ${proxy.stats.upToClient}B origin->client`,
);
