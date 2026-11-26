# @initearth/layui-request-component

基于 layui `component` 构建的浏览器 HTTP 请求组件。组件遵循 [layui component 构建器](https://layui.dev/docs/2/component/) 规范，使用 `layui.define` / `layui.component` 定义并导出为 `layui.request`。

> 组件在浏览器中基于 `XMLHttpRequest` 实现，上传使用 `FormData`，下载使用 `Blob`。

## 安装

```bash
npm install @initearth/layui-request-component
```

将构建产物 `node_modules/@initearth/layui-request-component/dist/request.js` 放到 layui 扩展模块目录，例如 `static/layui/exts/request.js`，然后扩展 layui 模块路径：

```js
layui.config({
  base: '/static/layui/exts/'
}).use(['request'], function () {
  var request = layui.request;
});
```

模块依赖全局 `layui`，使用打包器时请在 layui 全局对象就绪后再加载 `request.js`。

## 快速开始

```js
layui.use('request', function () {
  var request = layui.request;

  var http = request.create({
    baseURL: 'https://api.example.com',
    timeout: 10000,
    header: { Authorization: 'Bearer token' }
  });

  http.get('/users', { params: { page: 1 } })
    .then(function (response) {
      console.log(response.data, response.statusCode, response.header);
    })
    .catch(function (error) {
      console.log(error.code, error.config, error.response);
    });

  http.post('/users', { name: 'Ada' });
});
```

也可以直接使用组件级默认实例：

```js
request.set({ baseURL: 'https://api.example.com' });
request.get('/ping');
```

## API

### 创建实例

```js
var http = request.create(defaults);
// 等价于
var http = request.render(defaults);
```

`create/render` 返回一个实例对象，包含以下方法：

- `request(config)`
- `get(url, config?)`, `delete`, `head`, `options`
- `post(url, data, config?)`, `put`, `patch`
- `upload(config)`, `download(config)`
- `setConfig(defaults)`, `abortAll()`, `reload(options)`

若传入 `elem`，会按 layui component 规范绑定实例 id、支持 `lay-options` 和 `reload(id, options)`；设置 `immediate: true` 可在渲染时自动发起一次请求。

### 请求配置

| 配置 | 说明 |
| --- | --- |
| `url` | 请求地址，相对地址与 `baseURL` 拼接，绝对地址不拼接 |
| `method` | 请求方法，默认 `GET` |
| `baseURL` | 基础地址 |
| `header` | 请求头，大小写不敏感合并；`null` / `undefined` 可删除继承值 |
| `params` | 查询参数，数组序列化为 `key[]=v1&key[]=v2`，日期转 ISO，对象转 JSON |
| `paramsSerializer` | 自定义查询参数序列化函数 |
| `data` | 请求体，对象自动转为 JSON 并补充 `Content-Type` |
| `timeout` | 超时时间（毫秒） |
| `withCredentials` | 跨域是否携带凭据 |
| `responseType` | `''`、`text`、`json`、`blob`、`arraybuffer`、`document` |
| `validateStatus` | 成功状态判断，默认 `200 <= status < 300` |
| `signal` | 取消信号，配合 `request.createCancelSource()` 使用 |
| `onTask` | 原生 `XMLHttpRequest` 就绪回调，参数为 `(xhr, control)` |
| `nativeOptions` | 透传到原生 `XMLHttpRequest` 的浏览器专有字段，如 `xhrFields` |
| `tsaMeta` | 业务元数据，不发送到服务端 |
| `tsaOptions.jsonParsing` | 响应 JSON 解析：`{ mode: 'auto'\|'strict', include: ['upload'] }` 或 `false` |
| `debug` | 是否输出调试日志，默认 `false` |

配置优先级：内置默认值 → `request.set()` 全局配置 → 实例默认配置 → 单次请求配置。`header` 按名称大小写不敏感合并，`params`、`data`、`formData`、`files` 等整体覆盖。

### 调试模式

```js
var http = request.create({
  debug: true,
  baseURL: '/api'
});
```

也可以全局开启：

```js
request.set({ debug: true });
```

开启后会在控制台输出 `request`、`response`、`error`、`abort` 四类日志。`Authorization`、`Token`、`Cookie` 等敏感请求头会自动显示为 `***`。

### 拦截器

```js
var requestId = http.interceptors.request.use(function (config, context) {
  config.header.Authorization = 'Bearer ' + getToken();
  return config;
});

var responseId = http.interceptors.response.use(function (response) {
  return response;
}, function (error) {
  throw error;
});

http.interceptors.request.eject(requestId);
http.interceptors.response.clear();
```

请求、响应拦截器均按注册顺序 FIFO 执行，支持同步或返回 Promise；组件级 `request.interceptors` 作用于默认实例。

### 取消请求

```js
var source = request.createCancelSource();

var pending = http.get('/slow', { signal: source.signal });
pending.onTask(function (xhr, control) {
  console.log('xhr ready', xhr);
});

source.cancel('页面离开');
// 或
pending.abort('用户取消');
```

`abort()` 幂等；取消错误为 `ERR_CANCELED`，`cancelMode` 为 `native` 或 `logical`。

### 上传与下载

```js
http.upload({
  url: '/files',
  file: fileInput.files[0],
  name: 'file',
  formData: { category: 'avatar' },
  onProgress: function (event) {
    console.log(event.percent);
  }
});

http.download({ url: '/report.pdf' }).then(function (response) {
  console.log(response.blob, response.tempFilePath);
});
```

浏览器没有 `filePath`，上传请传 `file` / `files`（`File` 或 `Blob`）或 `formData`。下载响应额外提供 `blob` 和 `tempFilePath`（object URL，使用完毕后请调用 `URL.revokeObjectURL`）。

### 错误处理与常量

```js
request.isTsaRequestError(error);
request.TsaRequestError.ERR_CANCELED;
request.ErrorCode.ERR_BAD_STATUS;
request.CancellationMode.NATIVE;
```

错误码：`ERR_INVALID_CONFIG`、`ERR_NETWORK`、`ERR_BAD_STATUS`、`ERR_BAD_RESPONSE`、`ERR_CANCELED`、`ERR_INTERCEPTOR`。响应对象包含 `data`、`statusCode`、`header`、`config`、`task`、`raw`。

### 事件

沿用 layui component 事件机制，事件名为 `事件(id)`：

```js
request.on('beforeRequest(my-http)', function (data) {
  // return false 可取消请求
});

request.on('afterRequest(my-http)', function (response) {
  console.log(response.data);
});

request.on('error(my-http)', function (error) {
  console.log(error.code);
});

var http = request.render({ id: 'my-http', elem: '#app', baseURL: '/api' });
```

## 封装为全局 http 模块

npm 包中提供了可直接复制的模板：

```text
node_modules/@initearth/layui-request-component/example/appConfig.js
node_modules/@initearth/layui-request-component/example/http.js
node_modules/@initearth/layui-request-component/example/debug.html
node_modules/@initearth/layui-request-component/example/theme/
node_modules/@initearth/layui-request-component/example/mock/
```

将它们和 `dist/request.js` 一起放到 layui 扩展目录，并保持文件名不变：

```text
static/layui/exts/
├── request.js
├── appConfig.js
├── http.js
├── debug.html
├── theme/
└── mock/
```

其中 `debug.html` 是鉴权调试页面，默认开启 `debug: true`，提供以下操作：

- **登录**：请求 `POST /login.json`，自动保存 Token 到 `layui.data` 并回填输入框
- **设置错误 Token**：写入一个无效 Token，用于触发鉴权失败
- **请求鉴权**：请求 `GET /me`，通过 `skipAuthIntercept` 跳过自动拦截，直接校验当前 Token 是否有效
- **401 自动拦截**：设置错误 Token 后请求 `/me`；响应拦截器会清除失效 Token、自动重新登录、保存新 Token 并重试原请求，响应区同时展示原始 401 错误和重试结果
- **403 拦截**：请求 `/forbidden`；响应拦截器记录拦截日志后抛出错误，保留当前 Token
- **清除**：删除 `layui.data` 中的 Token，并清空输入框

鉴权拦截逻辑封装在 `example/http.js` 的响应拦截器中：

- `401`：清除 Token → 重新登录 → 保存新 Token → 重试一次原请求，通过 `_authRetried` 防止无限重试，并在 config 上保留 `_originalError` 供页面展示
- `403`：记录日志 → 抛出错误，不清除 Token、不做自动重试
- `skipAuthIntercept`：单次请求配置，设为 `true` 可跳过上述 401 / 403 自动拦截
- 登录接口 `/login.json` 不注入 `Authorization`，避免携带旧 Token

页面只保留 Token 只读输入框、鉴权操作按钮、响应结果和调试日志，不再提供请求地址、方法、超时、参数等手动配置项。

本地调试时执行：

```bash
npm run watch
```

然后访问 `http://localhost:5173/example/debug.html`，页面会直接加载 `../dist/request.js`。

`watch` 模式会监听 `src/`、`example/` 和构建配置：

- 修改 `src/**/*.ts` 或构建配置：自动重新构建并刷新浏览器
- 修改 `example/**` 下的 HTML/CSS/JS：直接刷新浏览器
- 页面通过 Server-Sent Events 接收刷新指令，无需手动刷新

如果只需要静态预览而不自动重建，可使用 `npm run dev`。部署到业务项目时，请将 `dist/request.js` 也复制到同一扩展目录。

页面中统一使用：

```js
layui.config({
  base: '/static/layui/exts/'
}).use(['http'], function () {
  var http = layui.http;

  http.setToken('your-token');

  http.get('/users').then(function (response) {
    console.log(response.data);
  });

  http.removeToken();
});
```

`appConfig.js` 会读取 `window.APP_CONFIG` 覆盖默认配置，可用于区分开发/生产环境：

```html
<script>
  window.APP_CONFIG = {
    api: {
      baseURL: 'https://api.example.com',
      timeout: 10000
    },
    auth: {
      table: 'auth',
      key: 'Authorization',
      prefix: 'Bearer '
    }
  };
</script>
```

`http.js` 会：

- 根据 `appConfig.api` 创建 `request` 实例
- 从 `layui.data(table)` 读取 token
- 通过请求拦截器统一注入 `Authorization`
- 暴露 `setToken` / `getToken` / `removeToken` 及 `setAuthorization` 等别名

## 工程结构

```text
src/           TypeScript 源码（常量、错误、工具、拦截器、客户端、模块入口）
tests/         Vitest 测试
example/       appConfig.js、http.js、debug.html、theme/ 与 mock/ 调试模板
scripts/       构建辅助脚本
dist/          构建产物（request.js 与 .d.ts，发布时生成）
rollup.config.mjs
tsconfig.json
tsconfig.build.json
```

## 开发与测试

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
npm run watch
npm run check
```

- `npm run dev`：启动本地静态服务器，访问 `example/debug.html`
- `npm run watch`：自动重建并刷新浏览器，用于实时调试
- `npm run typecheck`：TypeScript 类型检查
- `npm test`：Vitest 运行测试
- `npm run build`：Rollup 打包浏览器脚本并生成类型声明
- `npm run check`：类型检查、测试、构建一次完成
- `npm run publish:dry-run`：发布前完整检查并预览 npm 包内容

## 许可证

MIT
