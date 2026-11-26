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

function encodeJWT(payload: any, expired = false): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, {
    iat: expired ? now - 3600 : now,
    exp: expired ? now - 60 : now + 600
  });
  return header + '.' + Buffer.from(JSON.stringify(body)).toString('base64url') + '.signature';
}

if (typeof (globalThis as any).btoa === 'undefined') {
  (globalThis as any).btoa = function (str: string) {
    return Buffer.from(str, 'binary').toString('base64');
  };
}
if (typeof (globalThis as any).atob === 'undefined') {
  (globalThis as any).atob = function (str: string) {
    return Buffer.from(str, 'base64').toString('binary');
  };
}

const dataStore: Record<string, Record<string, any>> = {};
let requestStub: any;

function loadExample(name: string): void {
  const file = fileURLToPath(new URL('../example/' + name, import.meta.url));
  vm.runInThisContext(readFileSync(file, 'utf8'), { filename: name });
}

describe('example http wrapper (JWT)', function () {
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

  it('appConfig 应包含 JWT 双 Token 配置', function () {
    const appConfig = (globalThis as any).layui.appConfig;

    expect(appConfig.api.baseURL).toBe('https://env.test');
    expect(appConfig.auth.table).toBe('auth');
    expect(appConfig.auth.key).toBe('Authorization');
    expect(appConfig.auth.accessKey).toBe('AccessToken');
    expect(appConfig.auth.refreshKey).toBe('RefreshToken');
  });

  it('http 应存储 Bearer accessToken 并注入 Authorization', function () {
    const http = (globalThis as any).layui.http;

    expect(typeof requestStub.onResponseError).toBe('function');

    http.setToken('abc');
    expect(http.getToken()).toBe('Bearer abc');

    const config: any = { header: {} };
    requestStub.onRequest(config);
    expect(config.header.Authorization).toBe('Bearer abc');

    http.removeToken();
    expect(http.getToken()).toBeUndefined();
  });

  it('refreshToken 应独立存储', function () {
    const http = (globalThis as any).layui.http;

    http.setToken('access');
    http.setRefreshToken('refresh-value');
    expect(http.getToken()).toBe('Bearer access');
    expect(http.getRefreshToken()).toBe('refresh-value');

    const refreshConfig: any = { url: '/refresh.json', header: { Authorization: 'old' } };
    requestStub.onRequest(refreshConfig);
    expect(refreshConfig.header.Authorization).toBeUndefined();

    http.clearAuth();
    expect(http.getToken()).toBeUndefined();
    expect(http.getRefreshToken()).toBeUndefined();
  });

  it('login / refresh 请求不应注入 Authorization', function () {
    const config: any = { url: '/login.json', header: {} };
    requestStub.onRequest(config);
    expect(config.header.Authorization).toBeUndefined();
  });

  it('parseJWT / tokenStatus 应正确解析 JWT 与过期状态', function () {
    const http = (globalThis as any).layui.http;

    const valid = encodeJWT({ sub: '1', name: 'Ada' });
    const parsed = http.parseJWT(valid);
    expect(parsed.header.typ).toBe('JWT');
    expect(parsed.payload.sub).toBe('1');
    expect(http.tokenStatus(valid).state).toBe('valid');
    expect(http.tokenStatus(encodeJWT({ sub: '1' }, true)).state).toBe('expired');
    expect(http.tokenStatus('not-a-jwt').state).toBe('invalid');
  });

  it('skipAuthIntercept 应跳过 401 自动刷新', function () {
    const error: any = {
      response: { statusCode: 401, data: { code: 401 } },
      config: { url: '/me', skipAuthIntercept: true }
    };

    expect(function () { requestStub.onResponseError(error); }).toThrow(error);
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

  it('401 应使用 refreshToken 换新 accessToken 并重试', async function () {
    const http = (globalThis as any).layui.http;
    const originalRequest = http.request;
    const retriedResponse: any = { statusCode: 200, data: { data: { valid: true } } };
    const newToken = encodeJWT({ sub: '1', name: 'Ada' });

    http.request = function (config: any) {
      if (config.url === '/refresh.json') {
        return Promise.resolve({ data: { data: { accessToken: newToken } } });
      }
      retriedResponse.config = config;
      return Promise.resolve(retriedResponse);
    };

    http.setToken(encodeJWT({ sub: '1' }, true));
    http.setRefreshToken('refresh-value');

    const originalError: any = {
      response: { statusCode: 401, data: { code: 401 } },
      config: { url: '/me' }
    };

    const response = await requestStub.onResponseError(originalError);
    expect(response).toBe(retriedResponse);
    expect(http.getToken()).toBe('Bearer ' + newToken);
    expect(retriedResponse.config._jwtRetried).toBe(true);
    expect(retriedResponse.config._originalError).toBe(originalError);

    http.request = originalRequest;
    http.clearAuth();
  });

  it('无 refreshToken 时 401 应直接清除 accessToken', function () {
    const http = (globalThis as any).layui.http;
    const error: any = {
      response: { statusCode: 401, data: { code: 401 } },
      config: { url: '/me' }
    };

    http.setToken('access');
    http.removeRefreshToken();
    expect(function () { requestStub.onResponseError(error); }).toThrow(error);
    expect(http.getToken()).toBeUndefined();
  });
});
