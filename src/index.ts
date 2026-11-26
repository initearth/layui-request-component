import { $, layuiGlobal } from './layui';
import { ERROR, CANCELLATION_MODE, METHODS } from './constants';
import { LuchRequestError, isLuchRequestError } from './error';
import { createCancelSource } from './cancel';
import { interceptorProxy } from './interceptor';
import { createClient } from './client';

let component: any;

function triggerEvent(owner: any, config: any, name: string, data: any): any {
  if (typeof layuiGlobal.event !== 'function') return undefined;

  const elem = (config && config.elem && config.elem[0]) ||
    (owner && owner.config && owner.config.elem && owner.config.elem[0]);
  const id = (config && config.id) || (owner && owner.config && owner.config.id) || '';

  return layuiGlobal.event.call(
    elem,
    component.CONST.MOD_NAME,
    name + '(' + id + ')',
    data
  );
}

layuiGlobal.define(['component', 'jquery'], function (exportModule: any) {
  component = layuiGlobal.component({
    name: 'request',
    isDeepReload: true,
    config: {
      baseURL: '',
      method: 'GET',
      header: {},
      params: {},
      timeout: 0,
      responseType: '',
      withCredentials: false,
      validateStatus: function (status: number) {
        return status >= 200 && status < 300;
      },
      luchOptions: {
        jsonParsing: { mode: 'auto' }
      }
    },
    CONST: {
      ERROR: ERROR,
      CANCELLATION_MODE: CANCELLATION_MODE
    },
    render: function () {
      const that = this;
      that.http = createClient(that.config, that, triggerEvent);

      if (that.config.immediate === true) {
        that.http.request(that.config.request || {});
      }

      triggerEvent(that, that.config, 'afterRender', {
        id: that.config.id,
        config: that.config
      });
    },
    extendsInstance: function () {
      const that = this;
      const inst: any = {
        interceptors: {
          request: interceptorProxy(function () { return that.http; }, 'request'),
          response: interceptorProxy(function () { return that.http; }, 'response')
        }
      };

      $.each(METHODS, function (_: number, name: string) {
        inst[name] = function () {
          return that[name].apply(that, arguments);
        };
      });

      return inst;
    }
  });

  const Class = component.Class;

  $.each(METHODS, function (_: number, name: string) {
    Class.prototype[name] = function () {
      if (!this.http) this.http = createClient(this.config, this, triggerEvent);
      return this.http[name].apply(this.http, arguments);
    };
  });

  Class.prototype.destroy = function () {
    if (this.http) this.http.destroy();
    delete this.http;
  };

  const baseClassReload = Class.prototype.reload;
  Class.prototype.reload = function (options?: any, type?: any) {
    if (this.http) this.http.abortAll();
    return baseClassReload.call(this, options, type);
  };

  let defaultClient: any;

  function getDefaultClient() {
    if (!defaultClient) defaultClient = createClient(component.config, null, triggerEvent);
    return defaultClient;
  }

  const baseSet = component.set;
  component.set = function (options: any) {
    baseSet.call(this, options);
    if (defaultClient) defaultClient.setConfig(this.config);
    return this;
  };

  function staticMethod(name: string) {
    return function () {
      const client = getDefaultClient();
      return client[name].apply(client, arguments);
    };
  }

  $.extend(component, {
    create: function (options?: any) {
      return component.render(options);
    },
    request: staticMethod('request'),
    get: staticMethod('get'),
    delete: staticMethod('delete'),
    head: staticMethod('head'),
    options: staticMethod('options'),
    post: staticMethod('post'),
    put: staticMethod('put'),
    patch: staticMethod('patch'),
    upload: staticMethod('upload'),
    download: staticMethod('download'),
    abortAll: staticMethod('abortAll'),
    interceptors: {
      request: interceptorProxy(getDefaultClient, 'request'),
      response: interceptorProxy(getDefaultClient, 'response')
    },
    LuchRequestError: LuchRequestError,
    isLuchRequestError: isLuchRequestError,
    CancellationMode: CANCELLATION_MODE,
    ErrorCode: ERROR,
    createCancelSource: createCancelSource
  });

  const baseRemoveInst = component.removeInst;
  component.removeInst = function (id: any) {
    const that = component.getInst(id);
    if (that && typeof that.destroy === 'function') that.destroy();
    return baseRemoveInst.call(component, id);
  };

  exportModule(component.CONST.MOD_NAME, component);
});

export type {
  InterceptorContext,
  InterceptorManager,
  LuchRequestConfig,
  LuchResponse,
  LuchRequestPromise,
  LuchRequestInstance,
  RequestComponent
} from './types';

export type { CancelSource } from './cancel';
