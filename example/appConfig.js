/**
 * appConfig - 应用全局配置模块
 * 放到 layui 扩展目录后，可通过 layui.appConfig 获取
 */
layui.define(function (exports) {
  var runtimeConfig = typeof window !== 'undefined' && window.APP_CONFIG
    ? window.APP_CONFIG
    : {};

  var defaults = {
    debug: false,
    api: {
      baseURL: 'https://api.example.com',
      timeout: 10000
    },
    auth: {
      table: 'auth',
      key: 'Authorization',
      prefix: 'Bearer ',
      accessKey: 'AccessToken',
      refreshKey: 'RefreshToken'
    }
  };

  var config = layui.$.extend(true, {}, defaults, runtimeConfig);

  exports('appConfig', config);
});
