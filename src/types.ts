export interface InterceptorContext {
  operation: string;
  config?: any;
  client?: any;
  owner?: any;
}

export interface InterceptorManager {
  use(
    onFulfilled?: (value: any, context: InterceptorContext) => any,
    onRejected?: (error: any) => any
  ): number;
  eject(id: number): void;
  clear(): void;
}

export interface TsaRequestConfig<D = any, P = any> {
  url?: string;
  method?: string;
  baseURL?: string;
  header?: Record<string, any>;
  params?: P;
  paramsSerializer?: (params: P) => string;
  data?: D;
  timeout?: number;
  responseType?: string;
  withCredentials?: boolean;
  debug?: boolean;
  validateStatus?: (status: number) => boolean;
  signal?: any;
  onTask?: (task: any, control: { abort(reason?: unknown): void }) => void;
  onProgress?: (event: ProgressEvent) => void;
  nativeOptions?: Record<string, any>;
  tsaMeta?: Record<string, any>;
  tsaOptions?: {
    jsonParsing?: false | { mode?: 'auto' | 'strict'; include?: string[]; [key: string]: any };
    [key: string]: any;
  };
  elem?: any;
  id?: string | number;
  immediate?: boolean;
  request?: TsaRequestConfig;
  [key: string]: any;
}

export interface TsaResponse<T = any> {
  data: T;
  statusCode: number;
  header: Record<string, string>;
  config: TsaRequestConfig;
  task?: any;
  raw: any;
  responseURL?: string;
  blob?: Blob;
  tempFilePath?: string;
  apFilePath?: string;
  filePath?: string;
  [key: string]: any;
}

export interface TsaRequestPromise<T> extends Promise<T> {
  task?: any;
  abort(reason?: unknown): this;
  onTask(
    listener: (task: any, control: { abort(reason?: unknown): void }) => void
  ): () => void;
}

export interface TsaRequestInstance {
  request<T = any>(config: TsaRequestConfig): TsaRequestPromise<TsaResponse<T>>;
  get<T = any>(url: string, config?: TsaRequestConfig): TsaRequestPromise<TsaResponse<T>>;
  delete<T = any>(url: string, config?: TsaRequestConfig): TsaRequestPromise<TsaResponse<T>>;
  head<T = any>(url: string, config?: TsaRequestConfig): TsaRequestPromise<TsaResponse<T>>;
  options<T = any>(url: string, config?: TsaRequestConfig): TsaRequestPromise<TsaResponse<T>>;
  post<T = any, D = any>(url: string, data?: D, config?: TsaRequestConfig<D>): TsaRequestPromise<TsaResponse<T>>;
  put<T = any, D = any>(url: string, data?: D, config?: TsaRequestConfig<D>): TsaRequestPromise<TsaResponse<T>>;
  patch<T = any, D = any>(url: string, data?: D, config?: TsaRequestConfig<D>): TsaRequestPromise<TsaResponse<T>>;
  upload<T = any>(config: TsaRequestConfig): TsaRequestPromise<TsaResponse<T | string>>;
  download(config: TsaRequestConfig): TsaRequestPromise<TsaResponse<any>>;
  setConfig(config: TsaRequestConfig): this;
  abortAll(): this;
  interceptors: { request: InterceptorManager; response: InterceptorManager };
}

export interface RequestComponent extends TsaRequestInstance {
  create(defaults?: TsaRequestConfig): TsaRequestInstance;
  render(options?: TsaRequestConfig): TsaRequestInstance;
  set(options: TsaRequestConfig): this;
  reload(id: string | number, options?: TsaRequestConfig): TsaRequestInstance | undefined;
  getInst(id: string | number): any;
  removeInst(id: string | number): void;
  on(events: string, callback: (...args: any[]) => any): this;
  Class: any;
  cache: any;
  config: TsaRequestConfig;
  index: number;
  CONST: Record<string, any>;
  TsaRequestError: any;
  isTsaRequestError: (error: unknown) => boolean;
  CancellationMode: { NATIVE: string; LOGICAL: string };
  ErrorCode: Record<string, string>;
  createCancelSource(): { signal: any; cancel(reason?: unknown): void };
}

declare global {
  interface Window {
    layui: { request: RequestComponent } & Record<string, any>;
  }
}
