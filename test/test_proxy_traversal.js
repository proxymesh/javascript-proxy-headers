#!/usr/bin/env node
/**
 * Proxy-traversal tests. These fail when a client dials the origin directly
 * instead of sending CONNECT through the local mock proxy.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { createProxyKy } from '../lib/ky-proxy.js';
import { createProxyRestClient } from '../lib/typed-rest-client-proxy.js';
import { request as undiciRequest } from '../lib/undici-proxy.js';
import {
    FAKE_PROXY_IP,
    makeSelfSignedCert,
    startConnectProxy,
    startOrigin,
} from './mock-connect-proxy.js';

const require = createRequire(import.meta.url);

function packageVersion(name) {
    const entry = require.resolve(name);
    let dir = dirname(entry);
    for (let i = 0; i < 6; i++) {
        try {
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            if (pkg.name === name) {
                return String(pkg.version);
            }
        } catch {
            // Walk up to the package root.
        }
        const parent = dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    throw new Error(`Could not read version for ${name}`);
}

async function withTunnel(fn) {
    const cert = makeSelfSignedCert();
    const origin = await startOrigin(cert);
    const proxy = await startConnectProxy();
    try {
        await fn({ cert, origin, proxy });
    } finally {
        origin.server.close();
        proxy.server.close();
        cert.cleanup();
    }
}

function assertTraversed(proxy, originPort) {
    assert.ok(proxy.stats.connects >= 1, 'mock proxy saw no CONNECT (traffic bypassed the proxy)');
    assert.match(
        proxy.stats.lastConnectHead,
        new RegExp(`^CONNECT 127\\.0\\.0\\.1:${originPort} HTTP/1\\.1`),
    );
    assert.match(proxy.stats.lastConnectHead, /X-ProxyMesh-Country: US/);
    assert.ok(
        proxy.stats.clientToUp > 0,
        'mock proxy tunneled 0 bytes from the client (CONNECT was not used as a tunnel)',
    );
    assert.ok(
        proxy.stats.upToClient > 0,
        'mock proxy tunneled 0 bytes from the origin',
    );
}

test('undici HTTPS traffic goes through the proxy tunnel', async () => {
    await withTunnel(async ({ origin, proxy }) => {
        const response = await undiciRequest(origin.url, {
            proxy: proxy.url,
            proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
            tlsOptions: { rejectUnauthorized: false },
        });
        const body = await response.body.json();
        assert.equal(response.statusCode, 200);
        assert.equal(body.ok, true);
        assert.equal(body.via, 'origin');
        assert.ok(response.proxyHeaders instanceof Map);
        assert.equal(response.proxyHeaders.get('x-proxymesh-ip'), FAKE_PROXY_IP);
        assert.equal(response.proxyHeaders.get('x-proxymesh-country-echo'), 'US');
        assertTraversed(proxy, origin.port);
    });
});

test('ky resolves fetch with a Response and traverses the proxy', async () => {
    const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
        await withTunnel(async ({ origin, proxy }) => {
            const api = await createProxyKy({
                proxy: proxy.url,
                proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
                kyOptions: { retry: 0, timeout: 10000 },
            });
            const response = await api(origin.url);
            const kyMajor = Number(packageVersion('ky').split('.')[0]);
            if (kyMajor >= 2) {
                const isResponse = response instanceof Response
                    || Object.prototype.toString.call(response) === '[object Response]';
                assert.equal(isResponse, true, 'ky 2 fetch must resolve with a Response');
            }
            assert.equal(response.proxyHeaders.get('x-proxymesh-ip'), FAKE_PROXY_IP);
            const body = await response.json();
            assert.equal(body.ok, true);
            assertTraversed(proxy, origin.port);
        });
    } finally {
        if (previous === undefined) {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
        }
    }
});

test('typed-rest-client _getAgent override tunnels HTTPS on v2 and v3', async () => {
    const trcVersion = packageVersion('typed-rest-client');
    const major = Number(trcVersion.split('.')[0]);
    assert.ok(major === 2 || major === 3, `unexpected typed-rest-client ${trcVersion}`);

    await withTunnel(async ({ origin, proxy }) => {
        const client = createProxyRestClient({
            userAgent: 'javascript-proxy-headers-test',
            proxy: proxy.url,
            proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
        });
        assert.equal(
            client.client._getAgent({ protocol: 'https:' }),
            client.proxyAgent,
            'HTTPS must use ProxyHeadersAgent via the _getAgent override',
        );
        client.proxyAgent.tlsOptions = { rejectUnauthorized: false };
        const result = await client.get(origin.url);
        assert.equal(result.statusCode, 200);
        assert.equal(result.result.ok, true);
        assert.equal(result.proxyHeaders.get('x-proxymesh-ip'), FAKE_PROXY_IP);
        assertTraversed(proxy, origin.port);
    });
});
