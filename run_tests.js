#!/usr/bin/env node
/**
 * Convenience wrapper for the proxy integration test harness.
 * Forwards all arguments to test/test_proxy_headers.js.
 *
 * @example
 * PROXY_URL='http://proxy:8080' node run_tests.js -v
 * node run_tests.js -l
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testScript = join(__dirname, 'test', 'test_proxy_headers.js');
const args = process.argv.slice(2);

const child = spawn(process.execPath, [testScript, ...args], {
    stdio: 'inherit',
    env: process.env,
});

child.on('error', (err) => {
    console.error(err);
    process.exit(1);
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 1);
});
