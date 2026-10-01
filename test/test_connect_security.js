#!/usr/bin/env node
/**
 * Unit tests for CONNECT request construction and HTTPS proxy TLS.
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
import https from 'node:https';

import {
    buildConnectRequest,
    parseProxyUrl,
    proxyReadyEvent,
} from '../lib/core/utils.js';
import { ProxyHeadersAgent } from '../lib/core/proxy-headers-agent.js';
import { createProxyAxios } from '../lib/axios-proxy.js';
import { createProxyMakeFetchHappen } from '../lib/make-fetch-happen-proxy.js';
import { createProxyRestClient } from '../lib/typed-rest-client-proxy.js';
import { getProxyHeaders } from '../lib/core/proxy-headers-store.js';

test('buildConnectRequest rejects CRLF in target host', () => {
    assert.throws(
        () => buildConnectRequest('example.com\r\nX-Injected: pwned', 443, null, {}),
        /Invalid character in target host/,
    );
    assert.throws(
        () => buildConnectRequest('example.com\nX-Injected: pwned', 443, null, {}),
        /Invalid character in target host/,
    );
    assert.throws(
        () => buildConnectRequest('example.com\0evil', 443, null, {}),
        /Invalid character in target host/,
    );
});

test('buildConnectRequest rejects invalid target ports', () => {
    assert.throws(
        () => buildConnectRequest('example.com', '443\r\nX-Injected: pwned', null, {}),
        /Invalid target port/,
    );
    assert.throws(
        () => buildConnectRequest('example.com', 0, null, {}),
        /Invalid target port/,
    );
    assert.throws(
        () => buildConnectRequest('example.com', 65536, null, {}),
        /Invalid target port/,
    );
    assert.throws(
        () => buildConnectRequest('example.com', 'not-a-port', null, {}),
        /Invalid target port/,
    );
});

test('buildConnectRequest rejects empty host', () => {
    assert.throws(
        () => buildConnectRequest('', 443, null, {}),
        /Target host must be a non-empty string/,
    );
});

test('buildConnectRequest still builds a valid CONNECT request', () => {
    const req = buildConnectRequest('example.com', '443', 'dXNlcjpwYXNz', {
        'X-ProxyMesh-Country': 'US',
    });
    assert.equal(
        req,
        [
            'CONNECT example.com:443 HTTP/1.1',
            'Host: example.com:443',
            'Proxy-Authorization: Basic dXNlcjpwYXNz',
            'X-ProxyMesh-Country: US',
            '',
            '',
        ].join('\r\n'),
    );
});

test('buildConnectRequest allows IPv6 hosts', () => {
    const req = buildConnectRequest('::1', 443, null, {});
    assert.match(req, /^CONNECT ::1:443 HTTP\/1\.1/);
});

test('proxyReadyEvent is secureConnect only for https:', () => {
    assert.equal(proxyReadyEvent('https:'), 'secureConnect');
    assert.equal(proxyReadyEvent('http:'), 'connect');
});

test('http:// proxy still sends plaintext CONNECT with Basic auth', async () => {
    const firstChunk = deferred();
    const server = net.createServer((sock) => {
        sock.once('data', (d) => {
            firstChunk.resolve(d);
            sock.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        });
    });
    await listen(server);

    try {
        const { port } = server.address();
        const agent = new ProxyHeadersAgent(`http://alice:supersecret@127.0.0.1:${port}`);
        const req = https.request({
            hostname: 'example.com',
            path: '/',
            method: 'GET',
            agent,
        });
        req.on('error', () => {});
        req.end();

        const raw = await firstChunk.promise;
        assert.equal(raw[0], 0x43, 'first byte should be C from CONNECT, not TLS');
        const text = raw.toString('utf8');
        assert.match(text, /^CONNECT example\.com:443 HTTP\/1\.1/);
        assert.match(text, /Proxy-Authorization: Basic YWxpY2U6c3VwZXJzZWNyZXQ=/);
    } finally {
        server.close();
    }
});

test('https:// proxy uses TLS before sending CONNECT with Basic auth', async () => {
    const { cert, key, cleanup } = makeSelfSignedCert();
    const connectSeen = deferred();
    const server = tls.createServer({ cert, key }, (sock) => {
        sock.once('data', (d) => {
            connectSeen.resolve(d.toString('utf8'));
            sock.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        });
    });
    await listen(server);

    try {
        const { port } = server.address();
        assert.equal(
            parseProxyUrl(`https://alice:supersecret@127.0.0.1:${port}`).protocol,
            'https:',
        );

        const agent = new ProxyHeadersAgent(`https://alice:supersecret@127.0.0.1:${port}`, {
            proxyTlsOptions: { rejectUnauthorized: false },
        });
        const req = https.request({
            hostname: 'example.com',
            path: '/',
            method: 'GET',
            agent,
        });
        req.on('error', () => {});
        req.end();

        const connectText = await connectSeen.promise;
        assert.match(connectText, /^CONNECT example\.com:443 HTTP\/1\.1/);
        assert.match(connectText, /Proxy-Authorization: Basic YWxpY2U6c3VwZXJzZWNyZXQ=/);
    } finally {
        server.close();
        cleanup();
    }
});

test('createConnection reports CRLF in host instead of writing it', async () => {
    const sawData = deferred();
    const server = net.createServer((sock) => {
        sock.once('data', (d) => sawData.resolve(d.toString('utf8')));
    });
    await listen(server);

    try {
        const { port } = server.address();
        const agent = new ProxyHeadersAgent(`http://127.0.0.1:${port}`);
        const err = await new Promise((resolve) => {
            agent.createConnection(
                { host: 'example.com\r\nX-Injected: pwned', port: 443 },
                (e) => resolve(e),
            );
        });
        assert.ok(err);
        assert.match(err.message, /Invalid character in target host/);
        const leaked = await Promise.race([
            sawData.promise.then((text) => text),
            delay(50).then(() => null),
        ]);
        assert.equal(leaked, null);
    } finally {
        server.close();
    }
});

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function listen(server) {
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeSelfSignedCert() {
    const dir = mkdtempSync(join(tmpdir(), 'jph-tls-'));
    const keyPath = join(dir, 'key.pem');
    const certPath = join(dir, 'cert.pem');
    execFileSync('openssl', [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-days',
        '1',
        '-nodes',
        '-subj',
        '/CN=127.0.0.1',
    ], { stdio: 'pipe' });
    return {
        key: readFileSync(keyPath),
        cert: readFileSync(certPath),
        cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
}

function createMitmConnectProxy({
    cert,
    key,
    headerFactory,
    delayMs = 0,
    keepAlive = false,
    originStatus = 200,
    originStatusText = originStatus === 200 ? 'OK' : 'Error',
    originCacheControl = null,
}) {
    let connectCount = 0;
    const server = net.createServer((sock) => {
        let buf = Buffer.alloc(0);
        let handedOff = false;
        sock.on('data', (d) => {
            if (handedOff) return;
            buf = Buffer.concat([buf, d]);
            if (buf.indexOf('\r\n\r\n') === -1) return;
            handedOff = true;
            connectCount += 1;
            const id = connectCount;
            sock.write(
                'HTTP/1.1 200 Connection Established\r\n' +
                headerFactory({ id }) +
                '\r\n',
            );
            const tlsSock = new tls.TLSSocket(sock, { isServer: true, cert, key });
            tlsSock.on('secure', async () => {
                if (delayMs) await delay(delayMs);
                let httpBuf = Buffer.alloc(0);
                const tryRespond = () => {
                    const sep = httpBuf.indexOf('\r\n\r\n');
                    if (sep === -1) return;
                    const reqLine = httpBuf.subarray(0, sep).toString('utf8').split('\r\n')[0];
                    httpBuf = httpBuf.subarray(sep + 4);
                    const body = JSON.stringify({ ok: originStatus === 200, id, reqLine });
                    const connHdr = keepAlive ? 'Connection: keep-alive\r\n' : 'Connection: close\r\n';
                    const cacheHdr = originCacheControl
                        ? `Cache-Control: ${originCacheControl}\r\n`
                        : '';
                    tlsSock.write(
                        `HTTP/1.1 ${originStatus} ${originStatusText}\r\n` +
                        'Content-Type: application/json\r\n' +
                        `Content-Length: ${Buffer.byteLength(body)}\r\n` +
                        cacheHdr +
                        connHdr +
                        '\r\n' +
                        body,
                    );
                    if (!keepAlive) {
                        tlsSock.end();
                        return;
                    }
                    if (httpBuf.includes('\r\n\r\n')) {
                        tryRespond();
                    }
                };
                tlsSock.on('data', (chunk) => {
                    httpBuf = Buffer.concat([httpBuf, chunk]);
                    tryRespond();
                });
            });
        });
        sock.on('error', () => {});
    });
    return server;
}

test('axios does not merge CONNECT Set-Cookie into origin response.headers', async () => {
    const { cert, key, cleanup } = makeSelfSignedCert();
    const proxy = createMitmConnectProxy({
        cert,
        key,
        headerFactory: () =>
            'X-ProxyMesh-IP: 203.0.113.9\r\nSet-Cookie: session=attacker-injected\r\nLocation: https://evil.example/\r\n',
    });
    await listen(proxy);
    try {
        const { port } = proxy.address();
        const client = await createProxyAxios({
            proxy: `http://127.0.0.1:${port}`,
        });
        client.proxyAgent.tlsOptions = { rejectUnauthorized: false };
        const response = await client.get('https://127.0.0.1/');
        assert.equal(response.proxyHeaders.get('x-proxymesh-ip'), '203.0.113.9');
        assert.equal(response.proxyHeaders.get('set-cookie'), 'session=attacker-injected');
        assert.equal(response.headers['set-cookie'], undefined);
        assert.equal(response.headers.location, undefined);
        assert.match(String(response.headers['content-type']), /application\/json/);
    } finally {
        proxy.close();
        cleanup();
    }
});

test('concurrent axios requests keep per-response CONNECT headers', async () => {
    const { cert, key, cleanup } = makeSelfSignedCert();
    const proxy = createMitmConnectProxy({
        cert,
        key,
        delayMs: 200,
        headerFactory: ({ id }) => `X-ProxyMesh-IP: 198.51.100.${id}\r\nX-Race-Id: ${id}\r\n`,
    });
    await listen(proxy);
    try {
        const { port } = proxy.address();
        const client = await createProxyAxios({
            proxy: `http://127.0.0.1:${port}`,
        });
        client.proxyAgent.tlsOptions = { rejectUnauthorized: false };
        client.proxyAgent.maxSockets = 10;
        const results = await Promise.all(
            ['/a', '/b', '/c', '/d'].map(async (path) => {
                const response = await client.get(`https://127.0.0.1${path}`);
                return {
                    body: response.data,
                    raceId: response.proxyHeaders.get('x-race-id'),
                    ip: response.proxyHeaders.get('x-proxymesh-ip'),
                };
            }),
        );
        for (const row of results) {
            assert.equal(row.ip, `198.51.100.${row.body.id}`);
            assert.equal(row.raceId, String(row.body.id));
        }
    } finally {
        proxy.close();
        cleanup();
    }
});

test('axios attaches proxyHeaders on non-2xx error.response', async () => {
    const { cert, key, cleanup } = makeSelfSignedCert();
    const proxy = createMitmConnectProxy({
        cert,
        key,
        originStatus: 500,
        headerFactory: () =>
            'X-ProxyMesh-IP: 203.0.113.50\r\nSet-Cookie: session=attacker-injected\r\n',
    });
    await listen(proxy);
    try {
        const { port } = proxy.address();
        const client = await createProxyAxios({
            proxy: `http://127.0.0.1:${port}`,
        });
        client.proxyAgent.tlsOptions = { rejectUnauthorized: false };
        await assert.rejects(
            () => client.get('https://127.0.0.1/'),
            (err) => {
                assert.equal(err.response.status, 500);
                assert.equal(err.response.proxyHeaders.get('x-proxymesh-ip'), '203.0.113.50');
                assert.equal(err.response.headers['set-cookie'], undefined);
                return true;
            },
        );
    } finally {
        proxy.close();
        cleanup();
    }
});

test('typed-rest-client RestClient.get sets result.proxyHeaders', async () => {
    const { cert, key, cleanup } = makeSelfSignedCert();
    const proxy = createMitmConnectProxy({
        cert,
        key,
        headerFactory: () => 'X-ProxyMesh-IP: 198.51.100.71\r\nX-Race-Id: rest\r\n',
    });
    await listen(proxy);
    try {
        const { port } = proxy.address();
        const client = createProxyRestClient({
            userAgent: 'javascript-proxy-headers-test',
            proxy: `http://127.0.0.1:${port}`,
        });
        client.proxyAgent.tlsOptions = { rejectUnauthorized: false };
        const result = await client.get('https://127.0.0.1/');
        assert.equal(result.statusCode, 200);
        assert.ok(result.proxyHeaders instanceof Map);
        assert.equal(result.proxyHeaders.get('x-proxymesh-ip'), '198.51.100.71');
        assert.equal(result.proxyHeaders.get('x-race-id'), 'rest');
        assert.equal(result.headers['set-cookie'], undefined);
        assert.equal(result.result.ok, true);
    } finally {
        proxy.close();
        cleanup();
    }
});

test('make-fetch-happen keep-alive reuse does not pick lastProxyHeaders', async () => {
    const { cert, key, cleanup } = makeSelfSignedCert();
    const proxy = createMitmConnectProxy({
        cert,
        key,
        delayMs: 80,
        keepAlive: true,
        headerFactory: ({ id }) => `X-ProxyMesh-IP: 198.51.100.${id}\r\nX-Race-Id: ${id}\r\n`,
    });
    await listen(proxy);
    let fetch;
    try {
        const { port } = proxy.address();
        fetch = createProxyMakeFetchHappen({
            proxy: `http://127.0.0.1:${port}`,
        });
        fetch.proxyAgent.tlsOptions = { rejectUnauthorized: false };
        fetch.proxyAgent.keepAlive = true;
        fetch.proxyAgent.maxSockets = 10;
        fetch.proxyAgent.maxFreeSockets = 10;

        const [first, second] = await Promise.all([
            fetch('https://127.0.0.1/a'),
            fetch('https://127.0.0.1/b'),
        ]);
        const firstBody = await first.json();
        const secondBody = await second.json();
        assert.equal(first.proxyHeaders.get('x-race-id'), String(firstBody.id));
        assert.equal(second.proxyHeaders.get('x-race-id'), String(secondBody.id));

        const other = await fetch('https://127.0.0.2/other');
        const otherBody = await other.json();
        assert.equal(other.proxyHeaders.get('x-race-id'), String(otherBody.id));
        assert.equal(fetch.proxyAgent.lastProxyHeaders.get('x-race-id'), String(otherBody.id));

        const reused = await fetch('https://127.0.0.1/reuse');
        const reusedBody = await reused.json();
        assert.ok(reusedBody.id === firstBody.id || reusedBody.id === secondBody.id);
        assert.equal(reused.proxyHeaders.get('x-race-id'), String(reusedBody.id));
        assert.notEqual(reused.proxyHeaders.get('x-race-id'), String(otherBody.id));
    } finally {
        fetch?.proxyAgent.destroy();
        proxy.close();
        cleanup();
    }
});

test('make-fetch-happen cache hit does not pick lastProxyHeaders', async () => {
    const { cert, key, cleanup } = makeSelfSignedCert();
    const cacheDir = mkdtempSync(join(tmpdir(), 'jph-mfh-cache-'));
    const proxy = createMitmConnectProxy({
        cert,
        key,
        originCacheControl: 'public, max-age=3600',
        headerFactory: ({ id }) => `X-ProxyMesh-IP: 198.51.100.${id}\r\nX-Race-Id: ${id}\r\n`,
    });
    await listen(proxy);
    let fetch;
    try {
        const { port } = proxy.address();
        fetch = createProxyMakeFetchHappen({
            proxy: `http://127.0.0.1:${port}`,
            cachePath: cacheDir,
            cache: 'force-cache',
            retry: false,
        });
        fetch.proxyAgent.tlsOptions = { rejectUnauthorized: false };

        const first = await fetch('https://127.0.0.1/cached');
        const firstBody = await first.json();
        assert.equal(first.proxyHeaders.get('x-race-id'), String(firstBody.id));

        const other = await fetch('https://127.0.0.2/other');
        const otherBody = await other.json();
        assert.equal(other.proxyHeaders.get('x-race-id'), String(otherBody.id));
        assert.notEqual(String(otherBody.id), String(firstBody.id));
        assert.equal(fetch.proxyAgent.lastProxyHeaders.get('x-race-id'), String(otherBody.id));

        const cached = await fetch('https://127.0.0.1/cached');
        const cachedBody = await cached.json();
        assert.equal(cached.headers.get('x-local-cache-status'), 'hit');
        assert.equal(cachedBody.id, firstBody.id);
        assert.equal(cached.proxyHeaders.get('x-race-id'), String(firstBody.id));
        assert.notEqual(cached.proxyHeaders.get('x-race-id'), String(otherBody.id));
    } finally {
        fetch?.proxyAgent.destroy();
        proxy.close();
        cleanup();
        rmSync(cacheDir, { recursive: true, force: true });
    }
});

test('getProxyHeaders reads CONNECT headers from the TLS socket', async () => {
    const { cert, key, cleanup } = makeSelfSignedCert();
    const proxy = createMitmConnectProxy({
        cert,
        key,
        headerFactory: () => 'X-ProxyMesh-IP: 192.0.2.8\r\n',
    });
    await listen(proxy);
    try {
        const { port } = proxy.address();
        const agent = new ProxyHeadersAgent(`http://127.0.0.1:${port}`, {
            tlsOptions: { rejectUnauthorized: false },
        });
        const incoming = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: '127.0.0.1',
                port: 443,
                path: '/',
                method: 'GET',
                agent,
                rejectUnauthorized: false,
            }, (res) => {
                res.resume();
                res.on('end', () => resolve(res));
            });
            req.on('error', reject);
            req.end();
        });
        const headers = getProxyHeaders(incoming);
        assert.equal(headers.get('x-proxymesh-ip'), '192.0.2.8');
    } finally {
        proxy.close();
        cleanup();
    }
});
