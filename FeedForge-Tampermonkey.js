// ==UserScript==
// @name         FeedForge RSS Fetcher
// @namespace    feedforge.tampermonkey
// @version      1.0
// @description  为 FeedForge 提供 GM_xmlhttpRequest 跨域获取能力，无需代理服务器
// @author       gitfox-enter
// @match        http://127.0.0.1:8080/*
// @match        http://localhost:8080/*
// @match        https://*.github.io/*
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    console.log('[FeedForge] GM script loaded');

    // 拦截全局 fetch，对代理 URL 使用 GM_xmlhttpRequest 绕过 CORS
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        const urlStr = typeof url === 'string' ? url : (url && url.url) || url.toString();

        const isProxyRequest =
            urlStr.includes('/proxy?url=') ||
            urlStr.includes('allorigins.win') ||
            urlStr.includes('corsproxy.io') ||
            urlStr.includes('codetabs.com');

        if (!isProxyRequest) {
            return originalFetch.apply(this, arguments);
        }

        let targetUrl = '';
        try {
            if (urlStr.includes('/proxy?url=')) {
                targetUrl = decodeURIComponent(urlStr.split('/proxy?url=')[1].split('&')[0]);
            } else if (urlStr.includes('allorigins.win')) {
                targetUrl = decodeURIComponent(urlStr.split('url=')[1]);
            } else if (urlStr.includes('corsproxy.io')) {
                targetUrl = decodeURIComponent(urlStr.replace('https://corsproxy.io/?', ''));
            } else if (urlStr.includes('codetabs.com')) {
                targetUrl = decodeURIComponent(urlStr.split('quest=')[1]);
            }
        } catch (e) {}

        if (!targetUrl) {
            return originalFetch.apply(this, arguments);
        }

        console.log('[FeedForge] GM fetch:', targetUrl);

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: (options && options.method) || 'GET',
                url: targetUrl,
                headers: (options && options.headers) || {
                    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
                },
                timeout: 20000,
                onload: function(response) {
                    const contentTypeMatch = response.responseHeaders.match(/content-type:\s*(.*)/i);
                    const ct = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/xml';
                    const resp = new Response(response.responseText, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: { 'Content-Type': ct }
                    });
                    resolve(resp);
                },
                onerror: function(error) {
                    reject(new Error('GM request failed: ' + (error.error || error.message || 'Network error')));
                },
                ontimeout: function() {
                    reject(new Error('GM request timeout'));
                },
                onabort: function() {
                    reject(new Error('GM request aborted'));
                }
            });
        });
    };

    // 暴露全局函数供 FeedForge 直接调用（可选）
    window.FeedForgeGMFetch = function(targetUrl) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: targetUrl,
                headers: { 'Accept': 'application/rss+xml, application/atom+xml, */*' },
                timeout: 20000,
                onload: resolve,
                onerror: (e) => reject(new Error(e.error || e.message || 'Network error')),
                ontimeout: () => reject(new Error('Timeout')),
            });
        });
    };

    console.log('[FeedForge] fetch interceptor installed');
})();
