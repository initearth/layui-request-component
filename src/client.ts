import { $ } from './layui';
import { ERROR, CANCELLATION_MODE, PROTECTED_NATIVE_KEYS } from './constants';
import { LuchRequestError, isLuchRequestError } from './error';
import { createInterceptorManager, runInterceptorChain } from './interceptor';
import {
  isPlainObject,
  mergeConfig,
  mergeHeaders,
  buildFullURL,
  parseResponseHeader,
  parseData
} from './utils';

type Emit = (owner: any, config: any, name: string, data: any) => any;

function canceledError(context: any, reason?: any): LuchRequestError {
  return new LuchRequestError(reason ? String(reason) : '请求已取消', ERROR.ERR_CANCELED, {
    config: context.config,
    task: context.task,
    cancelMode: CANCELLATION_MODE.LOGICAL,
    raw: reason
  });
}

function normalizeError(error: any, context: any): LuchRequestError {
  if (isLuchRequestError(error)) return error;

  return new LuchRequestError(
    error && error.message ? error.message : '请求处理失败',
    ERROR.ERR_INTERCEPTOR,
    {
      config: context.config,
      task: context.task,
      cause: error,
      raw: error
    }
  );
}

function addTaskListener(context: any, listener: any): () => void {
  if (typeof listener !== 'function') return function () {};

  const entry = { listener: listener };
  context.taskListeners.push(entry);

  if (context.task) {
    try {
      listener(context.task, { abort: function (reason?: any) { context.abort(reason); } });
    } catch (e) {}
  }

  return function () {
    const index = context.taskListeners.indexOf(entry);
    if (index > -1) context.taskListeners.splice(index, 1);
  };
}

function notifyTask(context: any, task: any): void {
  const control = { abort: function (reason?: any) { context.abort(reason); } };

  $.each(context.taskListeners.slice(), function (_: number, entry: any) {
    try {
      entry.listener(task, control);
    } catch (e) {}
  });
}

function applyNativeOptions(xhr: any, nativeOptions: any): void {
  if (!isPlainObject(nativeOptions)) return;

  $.each(nativeOptions, function (key: string, value: any) {
    if (PROTECTED_NATIVE_KEYS[key]) return;

    try {
      if (key === 'xhrFields' && isPlainObject(value)) {
        $.each(value, function (field: string, fieldValue: any) {
          xhr[field] = fieldValue;
        });
      } else if (key in xhr) {
        xhr[key] = value;
      }
    } catch (e) {}
  });
}

function buildRequestBody(conf: any, operation: string): any {
  if (operation === 'download') return null;

  if (operation === 'upload') {
    if (typeof FormData === 'undefined') {
      throw new LuchRequestError('当前环境不支持 FormData', ERROR.ERR_INVALID_CONFIG, { config: conf });
    }

    let formData: any;
    if (conf.formData instanceof FormData) {
      formData = conf.formData;
    } else {
      formData = new FormData();
      $.each(conf.formData || {}, function (key: string, value: any) {
        if (value !== undefined && value !== null) formData.append(key, value);
      });
    }

    const name = conf.name || 'file';
    const file = conf.file || conf.filePath;
    if (file !== undefined && file !== null) {
      formData.append(name, file, conf.fileName || file.name || 'file');
    }

    if (conf.files && !file) {
      $.each(conf.files, function (_: number, item: any) {
        formData.append(name, item, item.name || 'file');
      });
    }

    return formData;
  }

  const method = String(conf.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return null;

  const data = conf.data;
  if (data === undefined || data === null) return null;

  if (typeof data === 'string' ||
    (typeof FormData !== 'undefined' && data instanceof FormData) ||
    (typeof Blob !== 'undefined' && data instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) ||
    (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams)) {
    return data;
  }

  const json = JSON.stringify(data);
  if (json !== undefined) {
    let hasContentType = false;
    $.each(conf.header || {}, function (key: string) {
      if (String(key).toLowerCase() === 'content-type') hasContentType = true;
    });
    if (!hasContentType) {
      conf.header = mergeHeaders(conf.header, { 'Content-Type': 'application/json;charset=UTF-8' });
    }
  }

  return json;
}

function buildResponse(conf: any, xhr: any, context: any, operation: string): any {
  const responseType = conf.responseType || (operation === 'download' ? 'blob' : '');
  let rawData: any;

  try {
    rawData = (responseType === '' || responseType === 'text') ? xhr.responseText : xhr.response;
  } catch (e) {
    rawData = xhr.responseText;
  }

  let data = rawData;
  if (operation !== 'download') {
    data = parseData(
      rawData,
      conf.luchOptions && conf.luchOptions.jsonParsing,
      operation
    );
  }

  const header = parseResponseHeader(xhr.getAllResponseHeaders ? xhr.getAllResponseHeaders() : '');
  const response: any = {
    data: data,
    statusCode: xhr.status,
    header: header,
    config: conf,
    task: xhr,
    raw: {
      data: rawData,
      status: xhr.status,
      header: header,
      xhr: xhr
    },
    responseURL: xhr.responseURL || ''
  };

  if (operation === 'download') {
    response.blob = (typeof Blob !== 'undefined' && rawData instanceof Blob) ? rawData : undefined;
    if (response.blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectURL = URL.createObjectURL(response.blob);
      response.tempFilePath = objectURL;
      response.apFilePath = objectURL;
      response.filePath = objectURL;
    }
  }

  return response;
}

function dispatch(conf: any, context: any, operation: string): Promise<any> {
  return new Promise(function (resolve, reject) {
    if (context.canceled) {
      reject(canceledError(context, undefined));
      return;
    }

    let xhr: any;
    try {
      xhr = new XMLHttpRequest();
    } catch (e) {
      reject(new LuchRequestError('无法创建 XMLHttpRequest', ERROR.ERR_INVALID_CONFIG, {
        config: conf,
        cause: e
      }));
      return;
    }

    context.task = xhr;
    context.promise.task = xhr;
    notifyTask(context, xhr);

    const method = operation === 'request' ? String(conf.method || 'GET').toUpperCase() : 'POST';

    try {
      xhr.open(method, conf.fullURL, true);
    } catch (e) {
      reject(new LuchRequestError('请求地址或方法无效', ERROR.ERR_INVALID_CONFIG, {
        config: conf,
        cause: e,
        task: xhr
      }));
      return;
    }

    applyNativeOptions(xhr, conf.nativeOptions);

    if ('withCredentials' in xhr) xhr.withCredentials = !!conf.withCredentials;
    if (conf.timeout) xhr.timeout = conf.timeout;

    const responseType = conf.responseType || (operation === 'download' ? 'blob' : '');
    try {
      if (responseType) xhr.responseType = responseType;
    } catch (e) {}

    let body: any;
    try {
      body = buildRequestBody(conf, operation);
    } catch (e) {
      reject(isLuchRequestError(e)
        ? e
        : new LuchRequestError((e as Error).message, ERROR.ERR_INVALID_CONFIG, {
          config: conf,
          cause: e,
          task: xhr
        }));
      return;
    }

    $.each(conf.header || {}, function (key: string, value: any) {
      if (value !== undefined && value !== null) {
        try {
          xhr.setRequestHeader(key, String(value));
        } catch (e) {}
      }
    });

    if (operation === 'upload' && typeof conf.onProgress === 'function' && xhr.upload) {
      xhr.upload.onprogress = conf.onProgress;
    }

    if (typeof conf.onTask === 'function') {
      try {
        conf.onTask(xhr, { abort: function (reason?: any) { context.abort(reason); } });
      } catch (e) {}
    }

    xhr.onload = function () {
      if (context.canceled) return;

      try {
        const response = buildResponse(conf, xhr, context, operation);
        const validate = typeof conf.validateStatus === 'function'
          ? conf.validateStatus
          : function (status: number) { return status >= 200 && status < 300; };

        if (validate(response.statusCode)) {
          resolve(response);
        } else {
          reject(new LuchRequestError('请求状态异常: ' + response.statusCode, ERROR.ERR_BAD_STATUS, {
            config: conf,
            task: xhr,
            response: response,
            raw: response.raw,
            statusCode: response.statusCode
          }));
        }
      } catch (e) {
        reject(isLuchRequestError(e)
          ? e
          : new LuchRequestError((e as Error).message || '响应处理失败', ERROR.ERR_BAD_RESPONSE, {
            config: conf,
            task: xhr,
            cause: e,
            raw: xhr.responseText
          }));
      }
    };

    xhr.onerror = function () {
      if (context.canceled) return;
      reject(new LuchRequestError('网络请求失败', ERROR.ERR_NETWORK, {
        config: conf,
        task: xhr,
        raw: { errMsg: 'request:fail', status: xhr.status }
      }));
    };

    xhr.ontimeout = function () {
      if (context.canceled) return;
      reject(new LuchRequestError('请求超时', ERROR.ERR_NETWORK, {
        config: conf,
        task: xhr,
        raw: { errMsg: 'request:timeout' }
      }));
    };

    xhr.onabort = function () {
      if (context.canceled) return;
      reject(new LuchRequestError('请求被中断', ERROR.ERR_CANCELED, {
        config: conf,
        task: xhr,
        cancelMode: CANCELLATION_MODE.LOGICAL
      }));
    };

    try {
      xhr.send(body);
    } catch (e) {
      reject(new LuchRequestError('请求发送失败', ERROR.ERR_INVALID_CONFIG, {
        config: conf,
        task: xhr,
        cause: e
      }));
    }
  });
}

export function executeRequest(
  client: any,
  options: any,
  owner: any,
  operation: string,
  emit: Emit
): any {
  operation = operation || 'request';

  const context: any = {
    client: client,
    owner: owner,
    operation: operation,
    canceled: false,
    task: null,
    taskListeners: [],
    removeSignal: null
  };

  let resolveOuter: (value: any) => void;
  let rejectOuter: (reason?: any) => void;
  const promise: any = new Promise(function (resolve, reject) {
    resolveOuter = resolve;
    rejectOuter = reject;
  });

  context.abort = function (reason?: any) {
    if (context.canceled) return;
    context.canceled = true;

    let mode = CANCELLATION_MODE.LOGICAL;
    if (context.task && typeof context.task.abort === 'function') {
      try {
        context.task.abort();
        mode = CANCELLATION_MODE.NATIVE;
      } catch (e) {}
    }

    if (typeof context.removeSignal === 'function') context.removeSignal();
    if (typeof context.cleanupPending === 'function') context.cleanupPending();

    rejectOuter!(new LuchRequestError(reason ? String(reason) : '请求已取消', ERROR.ERR_CANCELED, {
      config: context.config,
      task: context.task,
      cancelMode: mode,
      raw: reason
    }));
  };

  promise.task = undefined;
  promise.abort = function (reason?: any) {
    context.abort(reason);
    return promise;
  };
  promise.onTask = function (listener: any) {
    return addTaskListener(context, listener);
  };
  context.promise = promise;

  const pendingId = ++client._pendingIndex;
  client._pending[pendingId] = promise;
  context.cleanupPending = function () {
    delete client._pending[pendingId];
  };

  let config: any;
  try {
    config = mergeConfig(client.defaults, options || {});
    if (operation !== 'request') delete config.nativeOptions;
    context.config = config;
  } catch (e) {
    context.cleanupPending();
    rejectOuter!(normalizeError(e, context));
    return promise;
  }

  if (!config.url) {
    context.cleanupPending();
    rejectOuter!(new LuchRequestError('缺少请求地址 url', ERROR.ERR_INVALID_CONFIG, {
      config: config
    }));
    return promise;
  }

  if (emit(owner, config, 'beforeRequest', {
    config: config,
    operation: operation
  }) === false) {
    context.abort('beforeRequest 事件已取消请求');
    return promise;
  }

  if (config.signal) {
    if (config.signal.aborted) {
      context.abort(config.signal.reason);
      return promise;
    }

    if (typeof config.signal.addEventListener === 'function') {
      const onAbort = function () {
        context.abort(config.signal.reason);
      };
      config.signal.addEventListener('abort', onAbort);
      context.removeSignal = function () {
        try {
          config.signal.removeEventListener('abort', onAbort);
        } catch (e) {}
      };
    }
  }

  runInterceptorChain(client.interceptors.request, config, context, true)
    .then(function (finalConfig) {
      if (context.canceled) return;

      context.config = finalConfig;
      finalConfig.fullURL = buildFullURL(
        finalConfig.baseURL,
        finalConfig.url,
        finalConfig.params,
        finalConfig.paramsSerializer
      );

      return dispatch(finalConfig, context, operation).then(function (response) {
        return runInterceptorChain(client.interceptors.response, response, context, false);
      });
    })
    .then(function (response) {
      if (context.canceled) return;

      context.cleanupPending();
      if (typeof context.removeSignal === 'function') context.removeSignal();
      resolveOuter!(response);
      emit(owner, context.config, 'afterRequest', response);
    })
    .catch(function (error) {
      context.cleanupPending();
      if (typeof context.removeSignal === 'function') context.removeSignal();
      if (context.canceled) return;

      const normalized = normalizeError(error, context);
      emit(owner, context.config, 'error', normalized);
      rejectOuter!(normalized);
    });

  return promise;
}

export function createClient(defaults: any, owner: any, emit: Emit): any {
  const client: any = {
    defaults: mergeConfig(defaults || {}),
    interceptors: {
      request: createInterceptorManager(),
      response: createInterceptorManager()
    },
    _pending: {},
    _pendingIndex: 0
  };

  client.setConfig = function (config: any) {
    client.defaults = mergeConfig(config || {});
    return client;
  };

  client.request = function (config: any) {
    return executeRequest(client, config, owner, 'request', emit);
  };

  function withoutBody(method: string) {
    return function (url: string, config?: any) {
      return client.request($.extend({}, config || {}, { url: url, method: method }));
    };
  }

  function withBody(method: string) {
    return function (url: string, data?: any, config?: any) {
      return client.request($.extend({}, config || {}, {
        url: url,
        method: method,
        data: data
      }));
    };
  }

  client.get = withoutBody('GET');
  client.delete = withoutBody('DELETE');
  client.head = withoutBody('HEAD');
  client.options = withoutBody('OPTIONS');
  client.post = withBody('POST');
  client.put = withBody('PUT');
  client.patch = withBody('PATCH');

  client.upload = function (config: any) {
    return executeRequest(client, config, owner, 'upload', emit);
  };

  client.download = function (config: any) {
    return executeRequest(client, config, owner, 'download', emit);
  };

  client.abortAll = function () {
    $.each(client._pending, function (_: string, pending: any) {
      if (pending && typeof pending.abort === 'function') pending.abort('实例已销毁');
    });
    return client;
  };

  client.destroy = function () {
    client.abortAll();
    client.interceptors.request.clear();
    client.interceptors.response.clear();
    return client;
  };

  return client;
}
