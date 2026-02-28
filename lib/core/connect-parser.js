/**
 * HTTP CONNECT response parser.
 */

import { normalizeHeaderName } from './utils.js';

/**
 * Parse HTTP CONNECT response.
 * @param {Buffer|string} data - Raw response data
 * @returns {{ statusCode: number, statusMessage: string, headers: Map<string, string>, bodyStart: number }|null}
 */
export function parseConnectResponse(data) {
    const str = typeof data === 'string' ? data : data.toString('utf8');
    
    const headerEnd = str.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
        return null;
    }
    
    const headerSection = str.slice(0, headerEnd);
    const lines = headerSection.split('\r\n');
    
    if (lines.length === 0) {
        return null;
    }
    
    const statusLine = lines[0];
    const statusMatch = statusLine.match(/^HTTP\/\d+\.\d+\s+(\d+)\s*(.*)/);
    
    if (!statusMatch) {
        return null;
    }
    
    const statusCode = parseInt(statusMatch[1], 10);
    const statusMessage = statusMatch[2] || '';
    
    const headers = new Map();
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const colonIndex = line.indexOf(':');
        
        if (colonIndex > 0) {
            const name = normalizeHeaderName(line.slice(0, colonIndex).trim());
            const value = line.slice(colonIndex + 1).trim();
            headers.set(name, value);
        }
    }
    
    return {
        statusCode,
        statusMessage,
        headers,
        bodyStart: headerEnd + 4,
    };
}

/**
 * Check if buffer contains complete CONNECT response headers.
 * @param {Buffer} buffer - Data buffer
 * @returns {boolean}
 */
export function hasCompleteHeaders(buffer) {
    return buffer.includes('\r\n\r\n');
}

/**
 * Create a ConnectError with proxy response details.
 */
export class ConnectError extends Error {
    constructor(message, statusCode, statusMessage, headers) {
        super(message);
        this.name = 'ConnectError';
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
        this.proxyHeaders = headers;
    }
}
