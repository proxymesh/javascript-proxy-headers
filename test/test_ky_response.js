#!/usr/bin/env node
/**
 * ky 2.2 requires fetch to resolve with a global Response.
 * Does not require a live PROXY_URL.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import tls from 'node:tls';
import { gzipSync } from 'node:zlib';

import { createProxyKy } from '../lib/ky-proxy.js';

function listen(server) {
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
}

function makeSelfSignedCert() {
    const dir = mkdtempSync(join(tmpdir(), 'jph-ky-'));
    const keyPath = join(dir, 'key.pem');
    const certPath = join(dir, 'cert.pem');
    execFileSync('openssl', [
        'req', '-x509', '-newkey', 'rsa:2048',
        '-keyout', keyPath, '-out', certPath,
        '-days', '1', '-nodes', '-subj', '/CN=127.0.0.1',
    ], { stdio: 'pipe' });
    return {
        key: readFileSync(keyPath),
        cert: readFileSync(certPath),
        cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
}

/**
 * CONNECT proxy that terminates TLS and returns a small JSON origin response.
 * @param {{ cert: Buffer, key: Buffer, gzip?: boolean }} options
 */
function createJsonProxy({ cert, key, gzip = false }) {
    const connects = [];
    const payload = JSON.stringify({ ok: true });
    const rawBody = gzip ? gzipSync(payload) : Buffer.from(payload);
    const extraHeaders = gzip
        ? `Content-Encoding: gzip\r\nContent-Length: ${rawBody.length}\r\n`
        : `Content-Length: ${rawBody.length}\r\n`;

    const server = net.createServer((sock) => {
        let buf = Buffer.alloc(0);
        let handedOff = false;
        sock.on('data', (d) => {
            if (handedOff) return;
            buf = Buffer.concat([buf, d]);
            if (buf.indexOf('\r\n\r\n') === -1) return;
            handedOff = true;
            connects.push(buf.toString('utf8'));
            sock.write(
                'HTTP/1.1 200 Connection Established\r\n' +
                'X-ProxyMesh-IP: 203.0.113.22\r\n' +
                '\r\n',
            );
            const tlsSock = new tls.TLSSocket(sock, { isServer: true, cert, key });
            tlsSock.on('secure', () => {
                let httpBuf = Buffer.alloc(0);
                tlsSock.on('data', (chunk) => {
                    httpBuf = Buffer.concat([httpBuf, chunk]);
                    if (httpBuf.indexOf('\r\n\r\n') === -1) return;
                    const head = Buffer.from(
                        'HTTP/1.1 200 OK\r\n' +
                        'Content-Type: application/json\r\n' +
                        extraHeaders +
                        'Connection: close\r\n' +
                        '\r\n',
                    );
                    tlsSock.end(Buffer.concat([head, rawBody]));
                });
            });
            tlsSock.on('error', () => {});
        });
        sock.on('error', () => {});
    });
    server.connects = connects;
    return server;
}

async function withProxy(gzip, fn) {
    const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const { cert, key, cleanup } = makeSelfSignedCert();
    const proxy = createJsonProxy({ cert, key, gzip });
    await listen(proxy);
    try {
        await fn(proxy);
    } finally {
        proxy.close();
        cleanup();
        if (previous === undefined) {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
        }
    }
}

test('ky 2 fetch resolves to a global Response that keeps proxyHeaders', async () => {
    await withProxy(false, async (proxy) => {
        const { port } = proxy.address();
        const api = await createProxyKy({
            proxy: `http://127.0.0.1:${port}`,
            proxyHeaders: { 'X-ProxyMesh-Country': 'US' },
        });
        const response = await api('https://127.0.0.1/ip');
        assert.equal(response instanceof Response, true);
        assert.equal(Object.prototype.toString.call(response), '[object Response]');
        assert.equal(response.proxyHeaders.get('x-proxymesh-ip'), '203.0.113.22');
        assert.match(proxy.connects[0], /X-ProxyMesh-Country: US/);

        const cloned = response.clone();
        assert.equal(cloned.proxyHeaders, undefined);

        assert.deepEqual(await response.json(), { ok: true });
    });
});

test('ky 2 reads a gzip origin body node-fetch already decompressed', async () => {
    await withProxy(true, async (proxy) => {
        const { port } = proxy.address();
        const api = await createProxyKy({
            proxy: `http://127.0.0.1:${port}`,
        });
        const response = await api('https://127.0.0.1/ip');
        assert.equal(response instanceof Response, true);
        assert.equal(response.headers.get('content-encoding'), null);
        assert.deepEqual(await response.json(), { ok: true });
        assert.equal(response.proxyHeaders.get('x-proxymesh-ip'), '203.0.113.22');
    });
});
