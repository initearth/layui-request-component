import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';

function isPlainObject(value: any): boolean {
  return !!value && Object.prototype.toString.call(value) === '[object Object]' &&
    value.constructor === Object;
}

function extend(...args: any[]): any {
  let deep = false;
  if (args[0] === true) {
    deep = true;
    args.shift();
  }
  const target = args.shift() || {};

  args.forEach(function (source) {
    if (!source) return;
    Object.keys(source).forEach(function (key) {
      const value = source[key];
      if (value === undefined) return;
      if (deep && isPlainObject(value)) {
        if (!isPlainObject(target[key])) target[key] = {};
        extend(true, target[key], value);
      } else {
        target[key] = value;
      }
    });
  });

  return target;
}

const dataStore: Record<string, Record<string, any>> = {};
let requestStub: any;

function loadExample(name: string): void {
  const file = fileURLToPath(new URL('../example/' + name, import.meta.url));
  vm.runInThisContext(readFileSync(file, 'utf8'), { filename: name });
}

describe('example http wrapper', function () {
  beforeAll(function () {
    (globalThis as any).window = {
      APP_CONFIG: {
        api: {
          baseURL: 'https://env.test',
          timeout: 2500
        }
      }
    };

    (globalThis as any).layui = {
      $: { extend: extend },
      define: function (deps: any, factory: any) {
        if (typeof deps === 'function') {
          factory = deps;
        }
        factory(function (name: string, value: any) {
          (globalThis as any).layui[name] = value;
        });
      },
      data: function (table: string, settings?: any) {
        const store = dataStore[table] || (dataStore[table] = {});
        if (!settings) return store;
        if (settings.remove) {
          delete store[settings.key];
        } else {
          store[settings.key] = settings.value;
        }
        return store;
      },
      request: {
        create: function (defaults: any) {
          requestStub = {
            defaults: defaults,
            interceptors: {
              request: {
                use: function (handler: any) {
                  requestStub.onRequest = handler;
                  return 1;
                }
              },
              response: {
                use: function (onFulfilled: any, onRejected: any) {
                  requestStub.onResponse = onFulfilled;
                  requestStub.onResponseError = onRejected;
                  return 2;
                }
              }
            }
          };
          return requestStub;
        }
      }
    };

    loadExample('appConfig.js');
    loadExample('http.js');
  });

  it('appConfig 应合并 window.APP_CONFIG', function () {
    const appConfig = (globalThis as any).layui.appConfig;

    expect(appConfig.api.baseURL).toBe('https://env.test');
    expect(appConfig.api.timeout).toBe(2500);
    expect(appConfig.auth.table).toBe('auth');
    expect(appConfig.auth.key).toBe('Authorization');
  });

  it('http 应通过 layui.data 存储并注入 Authorization', function () {
    const http = (globalThis as any).layui.http;

    expect(requestStub.defaults.baseURL).toBe('https://env.test');
    expect(requestStub.defaults.timeout).toBe(2500);
    expect(typeof requestStub.onResponseError).toBe('function');

    http.setToken('abc');
    expect(http.getToken()).toBe('Bearer abc');
    expect((globalThis as any).layui.data('auth').Authorization).toBe('Bearer abc');

    const config: any = { header: {} };
    const result = requestStub.onRequest(config);
    expect(result.header.Authorization).toBe('Bearer abc');

    http.removeToken();
    expect(http.getToken()).toBeUndefined();

    const cleared: any = { header: { Authorization: 'old' } };
    requestStub.onRequest(cleared);
    expect(cleared.header.Authorization).toBeUndefined();
  });

  it('登录请求不应注入 Authorization', function () {
    const http = (globalThis as any).layui.http;

    http.setToken('abc');
    const config: any = { url: '/login.json', header: {} };
    requestStub.onRequest(config);
    expect(config.header.Authorization).toBeUndefined();

    http.removeToken();
  });

  it('skipAuthIntercept 应跳过 401 自动拦截', function () {
    const http = (globalThis as any).layui.http;
    const error: any = {
      response: { statusCode: 401, data: { code: 401 } },
      config: { url: '/me', skipAuthIntercept: true }
    };

    http.setToken('invalid');
    expect(function () { requestStub.onResponseError(error); }).toThrow(error);
    expect(http.getToken()).toBe('Bearer invalid');

    http.removeToken();
  });

  it('403 拦截不应清除 Token', function () {
    const http = (globalThis as any).layui.http;
    const error: any = {
      response: { statusCode: 403, data: { code: 403 } },
      config: { url: '/forbidden' }
    };

    http.setToken('abc');
    expect(function () { requestStub.onResponseError(error); }).toThrow(error);
    expect(http.getToken()).toBe('Bearer abc');

    http.removeToken();
  });

  it('401 拦截应保存原始错误并重新登录重试', async function () {
    const http = (globalThis as any).layui.http;
    const originalRequest = http.request;
    const retriedResponse: any = { statusCode: 200, data: { data: { valid: true } } };

    http.request = function (config: any) {
      if (config.url === '/login.json') {
        return Promise.resolve({ data: { data: { token: 'new-token' } } });
      }
      retriedResponse.config = config;
      return Promise.resolve(retriedResponse);
    };

    const originalError: any = {
      response: { statusCode: 401, data: { code: 401 } },
      config: { url: '/me' }
    };

    const response = await requestStub.onResponseError(originalError);
    expect(response).toBe(retriedResponse);
    expect(http.getToken()).toBe('Bearer new-token');
    expect(retriedResponse.config._originalError).toBe(originalError);
    expect(retriedResponse.config._authRetried).toBe(true);

    http.request = originalRequest;
    http.removeToken();
  });
});
