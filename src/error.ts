import { ERROR } from './constants';

export class TsaRequestError extends Error {
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
  __tsaRequestError: boolean;

  constructor(message?: string, code?: string, context: any = {}) {
    super(message || '');

    this.name = 'TsaRequestError';
    this.message = message || '';
    this.code = code || ERROR.ERR_INTERCEPTOR;
    this.config = context.config;
    this.task = context.task;
    this.response = context.response;
    this.cause = context.cause;
    this.raw = context.raw;
    this.cancelMode = context.cancelMode;
    this.statusCode = context.statusCode;
    this.__tsaRequestError = true;
    this.stack = new Error(this.message).stack;

    Object.setPrototypeOf(this, TsaRequestError.prototype);
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
      isTsaRequestError: true
    };
  }
}

TsaRequestError.ERR_INVALID_CONFIG = ERROR.ERR_INVALID_CONFIG;
TsaRequestError.ERR_NETWORK = ERROR.ERR_NETWORK;
TsaRequestError.ERR_BAD_STATUS = ERROR.ERR_BAD_STATUS;
TsaRequestError.ERR_BAD_RESPONSE = ERROR.ERR_BAD_RESPONSE;
TsaRequestError.ERR_CANCELED = ERROR.ERR_CANCELED;
TsaRequestError.ERR_INTERCEPTOR = ERROR.ERR_INTERCEPTOR;

export function isTsaRequestError(error: any): error is TsaRequestError {
  return !!(error && error.__tsaRequestError === true && error.name === 'TsaRequestError');
}
