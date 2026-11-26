import { ERROR } from './constants';

export class LuchRequestError extends Error {
  static ERR_INVALID_CONFIG: string;
  static ERR_NETWORK: string;
  static ERR_BAD_STATUS: string;
  static ERR_BAD_RESPONSE: string;
  static ERR_CANCELED: string;
  static ERR_INTERCEPTOR: string;

  code: string;
  config?: any;
  task?: any;
  response?: any;
  cause?: any;
  raw?: any;
  cancelMode?: string;
  statusCode?: number;
  __luchRequestError: boolean;

  constructor(message?: string, code?: string, context: any = {}) {
    super(message || '');

    this.name = 'LuchRequestError';
    this.message = message || '';
    this.code = code || ERROR.ERR_INTERCEPTOR;
    this.config = context.config;
    this.task = context.task;
    this.response = context.response;
    this.cause = context.cause;
    this.raw = context.raw;
    this.cancelMode = context.cancelMode;
    this.statusCode = context.statusCode;
    this.__luchRequestError = true;
    this.stack = new Error(this.message).stack;

    Object.setPrototypeOf(this, LuchRequestError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,
      code: this.code,
      statusCode: this.statusCode,
      config: this.config,
      cause: this.cause,
      raw: this.raw,
      cancelMode: this.cancelMode,
      isLuchRequestError: true
    };
  }
}

LuchRequestError.ERR_INVALID_CONFIG = ERROR.ERR_INVALID_CONFIG;
LuchRequestError.ERR_NETWORK = ERROR.ERR_NETWORK;
LuchRequestError.ERR_BAD_STATUS = ERROR.ERR_BAD_STATUS;
LuchRequestError.ERR_BAD_RESPONSE = ERROR.ERR_BAD_RESPONSE;
LuchRequestError.ERR_CANCELED = ERROR.ERR_CANCELED;
LuchRequestError.ERR_INTERCEPTOR = ERROR.ERR_INTERCEPTOR;

export function isLuchRequestError(error: any): error is LuchRequestError {
  return !!(error && error.__luchRequestError === true && error.name === 'LuchRequestError');
}
