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
