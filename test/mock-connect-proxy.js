/**
 * Local CONNECT proxy and HTTPS origin for adapter tests.
 * The proxy records CONNECT requests and tunneled byte counts so a test can
 * fail when a client dials the origin directly.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tls from 'node:tls';

export const FAKE_PROXY_IP = '203.0.113.7';

export function makeSelfSignedCert() {
    const dir = mkdtempSync(join(tmpdir(), 'jph-tls-'));
    const keyPath = join(dir, 'key.pem');
    const certPath = join(dir, 'cert.pem');
    const configPath = join(dir, 'openssl.cnf');
    writeFileSync(configPath, [
        '[req]',
        'distinguished_name=req_distinguished_name',
        'x509_extensions=v3_req',
        'prompt=no',
        '[req_distinguished_name]',
        'CN=127.0.0.1',
        '[v3_req]',
        'subjectAltName=IP:127.0.0.1,DNS:localhost',
        'basicConstraints=CA:FALSE',
        '',
    ].join('\n'));
    execFileSync('openssl', [
        'req', '-x509', '-newkey', 'rsa:2048',
        '-keyout', keyPath,
        '-out', certPath,
        '-days', '1',
        '-nodes',
        '-config', configPath,
        '-extensions', 'v3_req',
    ], { stdio: 'pipe' });
    return {
        key: readFileSync(keyPath),
        cert: readFileSync(certPath),
        certPath,
        cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
}

/**
 * HTTPS origin that answers one JSON body per request.
 * @param {{ cert: Buffer, key: Buffer }} tlsOptions
 */
export async function startOrigin(tlsOptions) {
    const server = tls.createServer({ cert: tlsOptions.cert, key: tlsOptions.key }, (socket) => {
        let buf = Buffer.alloc(0);
        socket.on('data', (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            const sep = buf.indexOf('\r\n\r\n');
            if (sep === -1) {
                return;
            }
            const head = buf.subarray(0, sep).toString('latin1');
            const body = JSON.stringify({
                ok: true,
                via: 'origin',
                requestLine: head.split('\r\n')[0],
            });
            socket.end(
                'HTTP/1.1 200 OK\r\n' +
                'Content-Type: application/json\r\n' +
                'Connection: close\r\n' +
                `Content-Length: ${Buffer.byteLength(body)}\r\n` +
                '\r\n' +
                body,
            );
        });
        socket.on('error', () => {});
    });
    await listen(server);
    const { port } = server.address();
    return {
        server,
        port,
        url: `https://127.0.0.1:${port}/`,
    };
}

/**
 * HTTP CONNECT proxy. Echoes X-ProxyMesh-* request headers and always
 * sends X-ProxyMesh-IP. Counts bytes piped after the CONNECT response.
 */
export async function startConnectProxy() {
    const stats = {
        connects: 0,
        clientToUp: 0,
        upToClient: 0,
        lastConnectHead: '',
    };
    const server = net.createServer((sock) => {
        let buf = Buffer.alloc(0);
        const onClientData = (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            const sep = buf.indexOf('\r\n\r\n');
            if (sep === -1) {
                return;
            }
            sock.off('data', onClientData);
            const head = buf.subarray(0, sep).toString('latin1');
            const rest = buf.subarray(sep + 4);
            stats.connects += 1;
            stats.lastConnectHead = head;
            const lines = head.split('\r\n');
            const requestLine = lines[0] || '';
            const target = requestLine.split(' ')[1] || '';
            const colon = target.lastIndexOf(':');
            let host = colon === -1 ? target : target.slice(0, colon);
            const port = colon === -1 ? 443 : Number(target.slice(colon + 1));
            if (host.startsWith('[') && host.endsWith(']')) {
                host = host.slice(1, -1);
            }
            const echo = lines.slice(1)
                .filter((line) => line.toLowerCase().startsWith('x-proxymesh'))
                .map((line) => {
                    const idx = line.indexOf(':');
                    const name = line.slice(0, idx).trim();
                    const value = line.slice(idx + 1).trim();
                    return `${name}-Echo: ${value}\r\n`;
                })
                .join('');

            const up = net.connect({ host, port });
            const fail = () => {
                sock.destroy();
                up.destroy();
            };
            up.on('error', fail);
            sock.on('error', fail);
            up.once('connect', () => {
                sock.write(
                    'HTTP/1.1 200 Connection established\r\n' +
                    `X-ProxyMesh-IP: ${FAKE_PROXY_IP}\r\n` +
                    echo +
                    '\r\n',
                );
                if (rest.length) {
                    stats.clientToUp += rest.length;
                    up.write(rest);
                }
                sock.on('data', (chunk) => {
                    stats.clientToUp += chunk.length;
                    up.write(chunk);
                });
                up.on('data', (chunk) => {
                    stats.upToClient += chunk.length;
                    sock.write(chunk);
                });
                sock.on('end', () => up.end());
                up.on('end', () => sock.end());
            });
        };
        sock.on('data', onClientData);
        sock.on('error', () => {});
    });
    await listen(server);
    const { port } = server.address();
    return {
        server,
        port,
        url: `http://127.0.0.1:${port}`,
        stats,
    };
}

function listen(server) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });
}
