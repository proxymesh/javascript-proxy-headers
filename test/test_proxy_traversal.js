#!/usr/bin/env node
/**
 * Proxy-traversal tests. These fail when a client dials the origin directly
 * instead of sending CONNECT through the local mock proxy.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
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
            requestTls: { rejectUnauthorized: false },
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

test('undici plain HTTP sends proxy headers through ProxyAgent', async () => {
    const origin = net.createServer((sock) => {
        sock.once('data', () => {
            const body = 'origin-ok';
            sock.end(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`);
        });
        sock.on('error', () => {});
    });
    await listen(origin);
    const originPort = origin.address().port;
    let sawProxyHeader = false;
    const proxy = net.createServer((sock) => {
        let buf = Buffer.alloc(0);
        const onData = (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            if (!buf.includes('\r\n\r\n')) {
                return;
            }
            sock.off('data', onData);
            const head = buf.toString('latin1');
            sawProxyHeader = /x-proxymesh-country:\s*US/i.test(head);
            const up = net.connect(originPort, '127.0.0.1', () => {
                up.write(buf);
            });
            sock.pipe(up);
            up.pipe(sock);
            up.on('error', () => sock.destroy());
            sock.on('error', () => up.destroy());
        };
        sock.on('data', onData);
    });
    await listen(proxy);
    try {
        const response = await undiciRequest(`http://127.0.0.1:${originPort}/`, {
            proxy: `http://127.0.0.1:${proxy.address().port}`,
            proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
        });
        assert.equal(response.statusCode, 200);
        assert.equal(await response.body.text(), 'origin-ok');
        assert.equal(sawProxyHeader, true);
        assert.equal(response.proxyHeaders.size, 0);
    } finally {
        origin.close();
        proxy.close();
    }
});

function listen(server) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });
}

test('ky resolves fetch with a Response and traverses the proxy', async () => {
    await withTunnel(async ({ origin, proxy }) => {
        const api = await createProxyKy({
            proxy: proxy.url,
            proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
            tlsOptions: { rejectUnauthorized: false },
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
