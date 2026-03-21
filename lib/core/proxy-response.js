/**
 * Wraps a fetch Response and exposes CONNECT proxy response headers.
 */

export class ProxyResponse {
    /**
     * @param {import('node-fetch').Response} response
     * @param {Map<string, string>|null|undefined} proxyHeaders
     */
    constructor(response, proxyHeaders) {
        this._response = response;
        this.proxyHeaders = proxyHeaders || new Map();

        this.ok = response.ok;
        this.status = response.status;
        this.statusText = response.statusText;
        this.headers = response.headers;
        this.url = response.url;
        this.redirected = response.redirected;
        this.type = response.type;
        this.body = response.body;
        this.bodyUsed = response.bodyUsed;
    }

    async text() {
        return this._response.text();
    }

    async json() {
        return this._response.json();
    }

    async blob() {
        return this._response.blob();
    }

    async arrayBuffer() {
        return this._response.arrayBuffer();
    }

    async formData() {
        return this._response.formData();
    }

    clone() {
        return new ProxyResponse(this._response.clone(), this.proxyHeaders);
    }
}
