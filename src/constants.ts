export const ERROR = {
  ERR_INVALID_CONFIG: 'ERR_INVALID_CONFIG',
  ERR_NETWORK: 'ERR_NETWORK',
  ERR_BAD_STATUS: 'ERR_BAD_STATUS',
  ERR_BAD_RESPONSE: 'ERR_BAD_RESPONSE',
  ERR_CANCELED: 'ERR_CANCELED',
  ERR_INTERCEPTOR: 'ERR_INTERCEPTOR'
};

export const CANCELLATION_MODE = {
  NATIVE: 'native',
  LOGICAL: 'logical'
};

export const NO_DEEP_KEYS: Record<string, number> = {
  data: 1,
  params: 1,
  formData: 1,
  files: 1,
  signal: 1,
  validateStatus: 1,
  paramsSerializer: 1,
  onTask: 1,
  onProgress: 1,
  success: 1,
  fail: 1,
  complete: 1
};

export const PROTECTED_NATIVE_KEYS: Record<string, number> = {
  url: 1,
  fullURL: 1,
  success: 1,
  fail: 1,
  complete: 1,
  method: 1,
  header: 1,
  data: 1,
  params: 1,
  baseURL: 1
};

export const METHODS = [
  'request', 'get', 'delete', 'head', 'options', 'post', 'put', 'patch',
  'upload', 'download', 'setConfig', 'abortAll'
];
