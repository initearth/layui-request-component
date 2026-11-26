/**
 * http - 基于 request component 封装的全局请求模块
 * 放到 layui 扩展目录后，可通过 layui.http 获取
 */
layui.define(['request', 'appConfig'], function (exports) {
  var request = layui.request;
  var appConfig = layui.appConfig;

  var api = appConfig.api || {};
  var auth = appConfig.auth || {};
  var table = auth.table || 'auth';
  var key = auth.key || 'Authorization';
  var prefix = auth.prefix === undefined ? 'Bearer ' : auth.prefix;

  function normalizeToken(token) {
    if (!token) return '';
    return new RegExp('^' + prefix, 'i').test(token) ? token : prefix + token;
  }

  function setToken(token) {
    layui.data(table, {
      key: key,
      value: normalizeToken(token)
    });
    return http;
  }

  function getToken() {
    return layui.data(table)[key];
  }

  function removeToken() {
    layui.data(table, {
      key: key,
      remove: true
    });
    return http;
  }

  var http = request.create({
    baseURL: api.baseURL || '',
    timeout: api.timeout || 0,
    debug: appConfig.debug === true
  });

  http.interceptors.request.use(function (config) {
    var token = getToken();

    config.header = config.header || {};

    if (token) {
      config.header[key] = token;
    } else {
      delete config.header[key];
      delete config.header[key.toLowerCase()];
    }

    return config;
  });

  http.config = appConfig;
  http.setToken = setToken;
  http.getToken = getToken;
  http.removeToken = removeToken;
  http.setAuthorization = setToken;
  http.getAuthorization = getToken;
  http.removeAuthorization = removeToken;

  exports('http', http);
});
