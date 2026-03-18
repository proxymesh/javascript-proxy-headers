import {
  ProxyHeadersAgent,
  parseProxyUrl,
  parseTargetUrl,
  buildConnectRequest,
} from "javascript-proxy-headers";
import { createProxyAxios, type ProxyAxiosInstance, type CreateProxyAxiosOptions } from "javascript-proxy-headers/axios";
import { createProxyFetch, type ProxyResponse } from "javascript-proxy-headers/node-fetch";
import { createProxyGot, type ProxyGotInstance, type CreateProxyGotOptions } from "javascript-proxy-headers/got";
import { request, type UndiciRequestOptions, type UndiciResponse } from "javascript-proxy-headers/undici";
import { proxyPlugin, createProxySuperagent, type ProxyPluginOptions, type ProxySuperagentClient } from "javascript-proxy-headers/superagent";

async function typecheck() {
  const agent = new ProxyHeadersAgent("http://proxy.example.com:8080", {
    proxyHeaders: { "X-ProxyMesh-Test": "1" },
    onProxyConnect: (headers) => {
      // Touch the Map type so TS checks the callback signature.
      void headers.get("x-proxymesh-test");
    },
  });

  const parsedProxy = parseProxyUrl("http://proxy.example.com:8080");
  const parsedTarget = parseTargetUrl("https://target.example.com");
  const connectReq = buildConnectRequest(
    parsedTarget.host,
    parsedTarget.port,
    parsedProxy.auth,
    { "X-ProxyMesh-Test": "1" },
  );
  void connectReq;

  const axiosOptions: CreateProxyAxiosOptions = {
    proxy: "http://proxy.example.com:8080",
    proxyHeaders: { "X-ProxyMesh-Test": "1" },
    onProxyConnect: (headers) => void headers.get("x-proxymesh-test"),
    axiosOptions: {},
  };
  const axiosPromise: Promise<ProxyAxiosInstance> = createProxyAxios(axiosOptions);
  const axiosInstance = await axiosPromise;
  axiosInstance.proxyAgent.lastProxyHeaders;

  const proxyFetch = createProxyFetch({
    proxy: "http://proxy.example.com:8080",
    proxyHeaders: { "X-ProxyMesh-Test": "1" },
  });
  const proxyFetchResp: Promise<ProxyResponse> = proxyFetch("https://example.com");
  void proxyFetchResp;

  const gotOptions = { proxy: "http://proxy.example.com:8080" } as CreateProxyGotOptions;
  const gotInstancePromise: Promise<ProxyGotInstance> = createProxyGot(gotOptions);
  const gotInstance = await gotInstancePromise;
  gotInstance.proxyAgent.proxyHost;

  const undiciOptions: UndiciRequestOptions = {
    proxy: "http://proxy.example.com:8080",
    headers: { "x-test": "1" },
  };
  const undiciResp: UndiciResponse = await request("https://example.com", undiciOptions);
  void undiciResp.proxyHeaders;

  const pluginOptions: ProxyPluginOptions = {
    proxy: "http://proxy.example.com:8080",
    proxyHeaders: { "X-ProxyMesh-Test": "1" },
    onProxyConnect: (headers) => void headers.get("x-proxymesh-test"),
  };
  const plugin = proxyPlugin(pluginOptions);
  void plugin;

  const superClientPromise: Promise<ProxySuperagentClient> = createProxySuperagent(pluginOptions);
  const superClient = await superClientPromise;
  superClient.get("https://example.com");
}

// Typecheck only; this is never executed by `tsc --noEmit`.
typecheck();

