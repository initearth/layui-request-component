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

export interface LuchRequestConfig<D = any, P = any> {
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
  luchMeta?: Record<string, any>;
  luchOptions?: {
    jsonParsing?: false | { mode?: 'auto' | 'strict'; include?: string[]; [key: string]: any };
    [key: string]: any;
  };
  elem?: any;
  id?: string | number;
  immediate?: boolean;
  request?: LuchRequestConfig;
  [key: string]: any;
}

export interface LuchResponse<T = any> {
  data: T;
  statusCode: number;
  header: Record<string, string>;
  config: LuchRequestConfig;
  task?: any;
  raw: any;
  responseURL?: string;
  blob?: Blob;
  tempFilePath?: string;
  apFilePath?: string;
  filePath?: string;
  [key: string]: any;
}

export interface LuchRequestPromise<T> extends Promise<T> {
  task?: any;
  abort(reason?: unknown): this;
  onTask(
    listener: (task: any, control: { abort(reason?: unknown): void }) => void
  ): () => void;
}

export interface LuchRequestInstance {
  request<T = any>(config: LuchRequestConfig): LuchRequestPromise<LuchResponse<T>>;
  get<T = any>(url: string, config?: LuchRequestConfig): LuchRequestPromise<LuchResponse<T>>;
  delete<T = any>(url: string, config?: LuchRequestConfig): LuchRequestPromise<LuchResponse<T>>;
  head<T = any>(url: string, config?: LuchRequestConfig): LuchRequestPromise<LuchResponse<T>>;
  options<T = any>(url: string, config?: LuchRequestConfig): LuchRequestPromise<LuchResponse<T>>;
  post<T = any, D = any>(url: string, data?: D, config?: LuchRequestConfig<D>): LuchRequestPromise<LuchResponse<T>>;
  put<T = any, D = any>(url: string, data?: D, config?: LuchRequestConfig<D>): LuchRequestPromise<LuchResponse<T>>;
  patch<T = any, D = any>(url: string, data?: D, config?: LuchRequestConfig<D>): LuchRequestPromise<LuchResponse<T>>;
  upload<T = any>(config: LuchRequestConfig): LuchRequestPromise<LuchResponse<T | string>>;
  download(config: LuchRequestConfig): LuchRequestPromise<LuchResponse<any>>;
  setConfig(config: LuchRequestConfig): this;
  abortAll(): this;
  interceptors: { request: InterceptorManager; response: InterceptorManager };
}

export interface RequestComponent extends LuchRequestInstance {
  create(defaults?: LuchRequestConfig): LuchRequestInstance;
  render(options?: LuchRequestConfig): LuchRequestInstance;
  set(options: LuchRequestConfig): this;
  reload(id: string | number, options?: LuchRequestConfig): LuchRequestInstance | undefined;
  getInst(id: string | number): any;
  removeInst(id: string | number): void;
  on(events: string, callback: (...args: any[]) => any): this;
  Class: any;
  cache: any;
  config: LuchRequestConfig;
  index: number;
  CONST: Record<string, any>;
  LuchRequestError: any;
  isLuchRequestError: (error: unknown) => boolean;
  CancellationMode: { NATIVE: string; LOGICAL: string };
  ErrorCode: Record<string, string>;
  createCancelSource(): { signal: any; cancel(reason?: unknown): void };
}

declare global {
  interface Window {
    layui: { request: RequestComponent } & Record<string, any>;
  }
}
