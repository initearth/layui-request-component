import { $ } from './layui';
import { ERROR, NO_DEEP_KEYS } from './constants';
import { LuchRequestError } from './error';

export function isPlainObject(value: any): boolean {
  return !!value &&
    Object.prototype.toString.call(value) === '[object Object]' &&
    value.constructor === Object;
}

export function copyValue(value: any): any {
  if (value && value.jquery) return value;
  if (value && value.nodeType) return value;
  if ($.isArray(value)) return $.extend(true, [], value);
  if (isPlainObject(value)) return $.extend(true, {}, value);
  return value;
}

export function mergeHeaders(base: any, incoming: any): Record<string, any> {
  const result: Record<string, any> = {};
  const output: Record<string, any> = {};

  $.each(base || {}, function (key: string, value: any) {
    if (value !== undefined && value !== null) {
      result[String(key).toLowerCase()] = { key: key, value: value };
    }
  });

  $.each(incoming || {}, function (key: string, value: any) {
    const lower = String(key).toLowerCase();
    if (value === undefined || value === null) {
      delete result[lower];
    } else {
      result[lower] = { key: key, value: value };
    }
  });

  $.each(result, function (_: string, item: any) {
    output[item.key] = item.value;
  });

  return output;
}

export function mergeLuchOptions(base: any, incoming: any): Record<string, any> {
  const output: Record<string, any> = isPlainObject(base) ? copyValue(base) : {};

  $.each(incoming || {}, function (key: string, value: any) {
    if (key === 'jsonParsing') {
      if (value === false) {
        output.jsonParsing = false;
      } else if (isPlainObject(value)) {
        output.jsonParsing = $.extend(
          {},
          isPlainObject(output.jsonParsing) ? output.jsonParsing : { mode: 'auto' },
          value
        );
      } else {
        output.jsonParsing = value;
      }
    } else {
      output[key] = copyValue(value);
    }
  });

  return output;
}

export function mergeConfig(...args: any[]): Record<string, any> {
  const result: Record<string, any> = {};

  args.forEach(function (arg) {
    if (!isPlainObject(arg)) return;

    $.each(arg, function (key: string, value: any) {
      if (value === undefined) return;

      if (key === 'header') {
        result.header = mergeHeaders(result.header, value);
      } else if (key === 'luchMeta') {
        result.luchMeta = (isPlainObject(result.luchMeta) && isPlainObject(value))
          ? $.extend({}, result.luchMeta, value)
          : copyValue(value);
      } else if (key === 'luchOptions') {
        result.luchOptions = mergeLuchOptions(result.luchOptions || {}, value);
      } else if (key === 'nativeOptions' && isPlainObject(result[key]) && isPlainObject(value)) {
        result[key] = $.extend({}, result[key], value);
      } else if (NO_DEEP_KEYS[key]) {
        result[key] = value;
      } else if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = $.extend(true, {}, result[key], value);
      } else {
        result[key] = copyValue(value);
      }
    });
  });

  return result;
}

export function serializeValue(value: any): string {
  if (value instanceof Date) {
    return typeof value.toISOString === 'function' ? value.toISOString() : String(value);
  }
  if (isPlainObject(value) || $.isArray(value)) return JSON.stringify(value);
  return String(value);
}

export function defaultParamsSerializer(params: any): string {
  const parts: string[] = [];

  $.each(params || {}, function (key: string, value: any) {
    if (value === undefined) return;

    if ($.isArray(value)) {
      $.each(value, function (_: number, item: any) {
        if (item === undefined) return;
        parts.push(encodeURIComponent(key + '[]') + '=' + encodeURIComponent(serializeValue(item)));
      });
    } else {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(serializeValue(value)));
    }
  });

  return parts.join('&');
}

export function isAbsoluteURL(url: string): boolean {
  return /^([a-z][a-z\d+.-]*:)?\/\//i.test(url);
}

export function buildFullURL(baseURL: any, url: any, params: any, serializer: any): string {
  let full = String(url || '');

  if (!isAbsoluteURL(full) && baseURL) {
    full = String(baseURL).replace(/\/+$/, '') + '/' + full.replace(/^\/+/, '');
  }

  const query = typeof serializer === 'function'
    ? serializer(params)
    : defaultParamsSerializer(params);

  if (query) {
    let hash = '';
    const hashIndex = full.indexOf('#');
    if (hashIndex > -1) {
      hash = full.slice(hashIndex);
      full = full.slice(0, hashIndex);
    }
    full += (full.indexOf('?') > -1 ? '&' : '?') + query + hash;
  }

  return full;
}

export function parseResponseHeader(raw: any): Record<string, string> {
  const header: Record<string, string> = {};

  if (!raw) return header;

  $.each(String(raw).split(/\r?\n/), function (_: number, line: string) {
    const index = line.indexOf(':');
    if (index < 0) return;
    const key = line.slice(0, index).replace(/^\s+|\s+$/g, '');
    if (key) header[key] = line.slice(index + 1).replace(/^\s+|\s+$/g, '');
  });

  return header;
}

export function parseData(text: any, jsonParsing: any, operation: string): any {
  if (typeof text !== 'string') return text;

  const setting = jsonParsing === undefined ? { mode: 'auto' } : jsonParsing;
  if (setting === false) return text;

  const mode = isPlainObject(setting) ? (setting.mode || 'auto') : 'auto';
  const include = isPlainObject(setting) ? setting.include : undefined;

  if (include && $.inArray(operation, include) === -1) return text;

  try {
    return JSON.parse(text);
  } catch (e) {
    if (mode === 'strict') {
      throw new LuchRequestError('响应不是有效的 JSON', ERROR.ERR_BAD_RESPONSE, {
        raw: text,
        cause: e
      });
    }
    return text;
  }
}
