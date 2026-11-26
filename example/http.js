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

  function setInvalidToken() {
    return setToken('invalid-token');
  }

  function payloadOf(response) {
    return response && response.data && response.data.data
      ? response.data.data
      : response && response.data;
  }

  var http = request.create({
    baseURL: api.baseURL || '',
    timeout: api.timeout || 0,
    debug: appConfig.debug === true
  });

  http.login = function (data) {
    return http.request({
      method: 'POST',
      url: '/login.json',
      data: data || { username: 'admin', password: '123456' }
    });
  };

  http.checkAuth = function (config) {
    return http.request(layui.$.extend({ method: 'GET', url: '/me' }, config || {}));
  };

  http.checkForbidden = function (config) {
    return http.request(layui.$.extend({ method: 'GET', url: '/forbidden' }, config || {}));
  };

  http.interceptors.request.use(function (config) {
    var token = getToken();
    var url = config.url || '';

    config.header = config.header || {};

    if (url.indexOf('/login.json') > -1) {
      delete config.header[key];
      delete config.header[key.toLowerCase()];
      return config;
    }

    if (token) {
      config.header[key] = token;
    } else {
      delete config.header[key];
      delete config.header[key.toLowerCase()];
    }

    return config;
  });

  http.interceptors.response.use(function (response) {
    return response;
  }, function (error) {
    var status = error.response && error.response.statusCode;
    var payload = error.response && error.response.data;
    var code = payload && payload.code;
    var config = error.config || {};
    var url = config.url || '';

    if (url.indexOf('/login.json') > -1 || config.skipAuthIntercept) {
      throw error;
    }

    if (status === 401 || code === 401) {
      console.log('[layui-request] auth intercepted: 401', {
        url: url,
        status: status,
        code: code
      });

      if (config._authRetried) {
        throw error;
      }

      removeToken();
      config._authRetried = true;
      config._originalError = error;

      return http.login().then(function (response) {
        var payload = payloadOf(response);
        if (payload && payload.token) setToken(payload.token);
        return http.request(config);
      });
    }

    if (status === 403 || code === 403) {
      console.log('[layui-request] auth intercepted: 403', {
        url: url,
        status: status,
        code: code
      });

      throw error;
    }

    throw error;
  });

  http.config = appConfig;
  http.setToken = setToken;
  http.getToken = getToken;
  http.removeToken = removeToken;
  http.setInvalidToken = setInvalidToken;
  http.payloadOf = payloadOf;
  http.setAuthorization = setToken;
  http.getAuthorization = getToken;
  http.removeAuthorization = removeToken;

  exports('http', http);
});
