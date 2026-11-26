import { beforeAll, describe, expect, it } from 'vitest';

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
      } else if (deep && Array.isArray(value)) {
        if (!Array.isArray(target[key])) target[key] = [];
        extend(true, target[key], value);
      } else {
        target[key] = value;
      }
    });
  });

  return target;
}

function each(obj: any, callback: (this: any, index: any, value: any) => void): any {
  if (obj === undefined || obj === null) return obj;
  if (Array.isArray(obj) || (typeof obj.length === 'number' && typeof obj !== 'string')) {
    for (let i = 0; i < obj.length; i++) callback.call(obj[i], i, obj[i]);
  } else {
    Object.keys(obj).forEach(function (key) {
      callback.call(obj[key], key, obj[key]);
    });
  }
  return obj;
}

const $: any = {
  extend: extend,
  each: each,
  isArray: Array.isArray,
  noop: function () {}
};

const eventHandlers: Record<string, Array<(...args: any[]) => any>> = {};

function eventKey(mod: string, events: string): string {
  return mod + '::' + events;
}

function setupLayui(): void {
  (globalThis as any).layui = {
    $: $,
    lay: {
      options: function () { return {}; },
      hasOwn: function (obj: any, key: string) {
        return Object.prototype.hasOwnProperty.call(obj, key);
      }
    },
    onevent: function (this: any, mod: string, events: string, callback: (...args: any[]) => any) {
      const key = eventKey(mod, events);
      (eventHandlers[key] = eventHandlers[key] || []).push(callback);
      return this;
    },
    event: function (this: any, mod: string, events: string, data: any) {
      const key = eventKey(mod, events);
      let result: any;
      (eventHandlers[key] || []).forEach(function (this: any, callback) {
        const value = callback.call(this, data);
        if (value === false) result = false;
      }, this);
      return result;
    },
    hint: function () {
      return { error: function () {} };
    },
    define: function (deps: any, factory: any) {
      if (typeof deps === 'function') {
        factory = deps;
      }
      factory(function (name: string, value: any) {
        (globalThis as any).layui[name] = value;
      });
    },
    component: function (settings: any) {
      const modName = settings.name;
      const instances: Record<string, any> = {};
      const component: any = {
        config: {},
        index: 0,
        CONST: extend(true, { MOD_NAME: modName }, settings.CONST),
        cache: { id: {} },
        set: function (options: any) {
          extend(true, component.config, options);
          return component;
        },
        on: function (this: any, events: string, callback: (...args: any[]) => any) {
          return (globalThis as any).layui.onevent.call(this, modName, events, callback);
        }
      };

      const Class: any = function (this: any, options: any) {
        this.index = ++component.index;
        this.config = extend(true, {}, this.config, component.config, options);
        this.init();
      };

      Class.prototype.config = settings.config;

      Class.prototype.init = function (this: any) {
        const options = this.config;
        options.id = options.id || this.index;
        instances[options.id] = this;
        if (typeof settings.beforeInit === 'function') settings.beforeInit.call(this, options);
        if (typeof settings.beforeRender === 'function') settings.beforeRender.call(this, options);
        if (typeof this.render === 'function') this.render(false);
        if (typeof this.events === 'function') this.events();
      };

      Class.prototype.reload = function (this: any, options: any) {
        this.config = extend(settings.isDeepReload, {}, this.config, options);
        this.init(true);
      };

      Class.prototype.render = settings.render;
      Class.prototype.events = settings.events;

      component.Class = Class;
      component.getInst = function (id: string | number) { return instances[id]; };
      component.removeInst = function (id: string | number) { delete instances[id]; };
      component.reload = function (id: string | number, options: any) {
        const inst = instances[id];
        if (!inst) return;
        inst.reload(options);
      };
      component.render = function (options: any) {
        const inst = new Class(options);
        const wrapper: any = {
          config: inst.config,
          id: inst.config.id,
          index: inst.index,
          reload: function (opts: any) { inst.reload(opts); }
        };
        if (typeof settings.extendsInstance === 'function') {
          extend(wrapper, settings.extendsInstance.call(inst));
        }
        return wrapper;
      };

      return component;
    }
  };
}

class MockXHR {
  static instances: MockXHR[] = [];

  headers: Record<string, any> = {};
  responseHeaders: Record<string, string> = {};
  status = 0;
  responseText: any = '';
  response: any = '';
  upload: any = {};
  aborted = false;
  method = '';
  url = '';
  async = false;
  body: any;
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;

  constructor() {
    MockXHR.instances.push(this);
  }

  open(method: string, url: string, async: boolean): void {
    this.method = method;
    this.url = url;
    this.async = async;
  }

  setRequestHeader(key: string, value: any): void {
    this.headers[key] = value;
  }

  getAllResponseHeaders(): string {
    return Object.keys(this.responseHeaders)
      .map(function (this: any, key) { return key + ': ' + this.responseHeaders[key]; }, this)
      .join('\r\n');
  }

  send(body: any): void {
    this.body = body;
  }

  abort(): void {
    this.aborted = true;
    if (typeof this.onabort === 'function') this.onabort();
  }

  respond(status: number, text: string, headers: Record<string, string> = {}): void {
    this.status = status;
    this.responseText = text;
    this.response = text;
    this.responseHeaders = headers;
    if (typeof this.onload === 'function') this.onload();
  }
}

function tick(): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

function lastXHR(): MockXHR {
  return MockXHR.instances[MockXHR.instances.length - 1];
}

describe('layui request component', function () {
  beforeAll(async function () {
    setupLayui();
    (globalThis as any).XMLHttpRequest = MockXHR;
    await import('../src/index');
  });

  it('覆盖模块导出、请求配置、拦截器、取消、事件和重载', async function () {
    const layui = (globalThis as any).layui;

    expect(layui.request).toBeTruthy();
    expect(layui.request.CONST.MOD_NAME).toBe('request');

    const http = layui.request.create({
      baseURL: 'https://api.test/',
      header: { 'X-A': '1', 'X-Remove': 'yes' }
    });

    const getPromise = http.get('/users', {
      params: { page: 1, tags: ['a', 'b'] },
      header: { 'x-a': '2', 'X-Remove': null }
    });
    await tick();
    let xhr = lastXHR();
    expect(xhr.method).toBe('GET');
    expect(xhr.url).toBe('https://api.test/users?page=1&tags%5B%5D=a&tags%5B%5D=b');
    expect(xhr.headers['x-a']).toBe('2');
    expect(xhr.headers['X-Remove']).toBeUndefined();
    xhr.respond(200, JSON.stringify({ ok: true }));
    const getResponse = await getPromise;
    expect(getResponse.data.ok).toBe(true);
    expect(getResponse.statusCode).toBe(200);

    const postPromise = http.post('/users', { name: 'Ada' });
    await tick();
    xhr = lastXHR();
    expect(xhr.method).toBe('POST');
    expect(xhr.body).toBe(JSON.stringify({ name: 'Ada' }));
    expect(xhr.headers['Content-Type']).toBe('application/json;charset=UTF-8');
    xhr.respond(201, '{"id":1}', { 'X-Result': 'created' });
    const postResponse = await postPromise;
    expect(postResponse.statusCode).toBe(201);
    expect(postResponse.header['X-Result']).toBe('created');

    const order: string[] = [];
    const requestId = http.interceptors.request.use(function (config: any) {
      order.push('request-1');
      config.header['X-Trace'] = 'yes';
      return config;
    });
    http.interceptors.request.use(function (config: any) {
      order.push('request-2');
      return config;
    });
    const responseId = http.interceptors.response.use(function (response: any) {
      order.push('response-1');
      response.data.mapped = true;
      return response;
    });

    const interceptPromise = http.get('/trace');
    await tick();
    xhr = lastXHR();
    expect(xhr.headers['X-Trace']).toBe('yes');
    xhr.respond(200, '{"value":1}');
    const interceptResponse = await interceptPromise;
    expect(interceptResponse.data.mapped).toBe(true);
    expect(order).toEqual(['request-1', 'request-2', 'response-1']);
    http.interceptors.request.eject(requestId);
    http.interceptors.response.eject(responseId);

    const badStatusPromise = http.get('/fail');
    await tick();
    xhr = lastXHR();
    xhr.respond(500, 'server error');
    try {
      await badStatusPromise;
      throw new Error('500 响应应当被拒绝');
    } catch (error: any) {
      expect(error.code).toBe('ERR_BAD_STATUS');
      expect(error.response.statusCode).toBe(500);
    }

    const abortedPromise = http.get('/slow');
    abortedPromise.abort('stop');
    try {
      await abortedPromise;
      throw new Error('主动取消应当被拒绝');
    } catch (error: any) {
      expect(error.code).toBe('ERR_CANCELED');
      expect(error.cancelMode).toBe('logical');
    }

    const sourceCancel = layui.request.createCancelSource();
    let taskSeen = false;
    const signalPromise = http.get('/cancel', { signal: sourceCancel.signal });
    signalPromise.onTask(function () { taskSeen = true; });
    await tick();
    expect(taskSeen).toBe(true);
    expect(lastXHR()).toBeInstanceOf(MockXHR);
    sourceCancel.cancel('source cancel');
    try {
      await signalPromise;
      throw new Error('signal 取消应当被拒绝');
    } catch (error: any) {
      expect(error.code).toBe('ERR_CANCELED');
      expect(lastXHR().aborted).toBe(true);
    }

    layui.request.set({ baseURL: 'https://global.test' });
    const staticPromise = layui.request.get('/ping');
    await tick();
    xhr = lastXHR();
    expect(xhr.url).toBe('https://global.test/ping');
    xhr.respond(200, '{}');
    await staticPromise;

    layui.request.on('beforeRequest(blocked)', function () { return false; });
    const blocked = layui.request.render({ id: 'blocked', baseURL: 'https://blocked.test' });
    try {
      await blocked.get('/x');
      throw new Error('beforeRequest 返回 false 应取消请求');
    } catch (error: any) {
      expect(error.code).toBe('ERR_CANCELED');
    }

    const reloadInst = layui.request.render({ id: 'reload-test', baseURL: 'https://old.test' });
    reloadInst.reload({ baseURL: 'https://new.test' });
    reloadInst.interceptors.request.use(function (config: any) {
      config.header['X-Reload'] = '1';
      return config;
    });
    const reloadPromise = reloadInst.get('/path');
    await tick();
    xhr = lastXHR();
    expect(xhr.url).toBe('https://new.test/path');
    expect(xhr.headers['X-Reload']).toBe('1');
    xhr.respond(200, '{}');
    await reloadPromise;
  });

  it('debug 模式应输出日志并遮蔽敏感请求头', async function () {
    const layui = (globalThis as any).layui;
    const logs: any[][] = [];
    const originalLog = console.log;
    console.log = function (...args: any[]) {
      logs.push(args);
    };

    try {
      const debugHttp = layui.request.create({
        id: 'debug-test',
        baseURL: 'https://debug.test',
        debug: true,
        header: {
          Authorization: 'Bearer secret',
          'X-Plain': 'visible'
        }
      });

      const debugPromise = debugHttp.get('/users');
      await tick();

      const requestLog = logs.find(function (args) {
        return String(args[0]).indexOf('[layui-request] request') === 0;
      });
      expect(requestLog).toBeTruthy();
      expect(requestLog![1].header.Authorization).toBe('***');
      expect(requestLog![1].header['X-Plain']).toBe('visible');

      lastXHR().respond(200, '{"ok":true}');
      await debugPromise;

      const responseLog = logs.find(function (args) {
        return String(args[0]).indexOf('[layui-request] response') === 0;
      });
      expect(responseLog).toBeTruthy();
      expect(responseLog![1].statusCode).toBe(200);
    } finally {
      console.log = originalLog;
    }
  });
});
