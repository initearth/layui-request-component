/**
 * http - 基于 request component 封装的 JWT 请求模块
 */
layui.define(['request', 'appConfig'], function (exports) {
  var request = layui.request;
  var appConfig = layui.appConfig;

  var api = appConfig.api || {};
  var auth = appConfig.auth || {};
  var table = auth.table || 'auth';
  var key = auth.key || 'Authorization';
  var prefix = auth.prefix === undefined ? 'Bearer ' : auth.prefix;
  var accessKey = auth.accessKey || 'AccessToken';
  var refreshKey = auth.refreshKey || 'RefreshToken';

  function readStore(name) {
    return layui.data(table)[name];
  }

  function writeStore(name, value) {
    layui.data(table, { key: name, value: value });
  }

  function removeStore(name) {
    layui.data(table, { key: name, remove: true });
  }

  function normalizeToken(token) {
    if (!token) return '';
    return new RegExp('^' + prefix, 'i').test(token) ? token : prefix + token;
  }

  function setToken(token) {
    writeStore(accessKey, normalizeToken(token));
    return http;
  }

  function getToken() {
    return readStore(accessKey);
  }

  function removeToken() {
    removeStore(accessKey);
    return http;
  }

  function setRefreshToken(token) {
    writeStore(refreshKey, token || '');
    return http;
  }

  function getRefreshToken() {
    return readStore(refreshKey);
  }

  function removeRefreshToken() {
    removeStore(refreshKey);
    return http;
  }

  function setInvalidToken() {
    var fakeHeader = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    var fakePayload = base64UrlEncode(JSON.stringify({
      sub: '0', name: 'invalid', iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600
    }));
    return setToken(fakeHeader + '.' + fakePayload + '.invalid-signature');
  }

  function setExpiredToken() {
    var now = Math.floor(Date.now() / 1000);
    var header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    var payload = base64UrlEncode(JSON.stringify({
      sub: '1', name: 'Ada Lovelace', role: 'admin',
      iat: now - 3600, exp: now - 60
    }));
    return setToken(header + '.' + payload + '.expired-signature');
  }

  function base64UrlEncode(str) {
    var bytes = unescape(encodeURIComponent(str));
    var base64 = btoa(bytes);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlDecode(str) {
    var base64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return decodeURIComponent(escape(atob(base64)));
  }

  function rawToken(token) {
    var value = token || '';
    return value.replace(new RegExp('^' + prefix, 'i'), '');
  }

  function parseJWT(token) {
    var parts = rawToken(token).split('.');
    if (parts.length !== 3) return null;
    try {
      return {
        header: JSON.parse(base64UrlDecode(parts[0])),
        payload: JSON.parse(base64UrlDecode(parts[1])),
        signature: parts[2]
      };
    } catch (e) {
      return null;
    }
  }

  function tokenStatus(token) {
    var parsed = parseJWT(token);
    if (!parsed) return { state: 'invalid', message: '不是有效的 JWT 结构', decoded: null };

    var now = Math.floor(Date.now() / 1000);
    var payload = parsed.payload;
    var expired = !payload.exp || payload.exp <= now;
    var secondsLeft = payload.exp ? payload.exp - now : 0;

    return {
      state: expired ? 'expired' : 'valid',
      message: expired ? 'Token 已过期' : 'Token 有效，剩余 ' + secondsLeft + ' 秒',
      secondsLeft: secondsLeft,
      decoded: parsed
    };
  }

  function payloadOf(response) {
    return response && response.data && response.data.data
      ? response.data.data
      : response && response.data;
  }

  function applyTokens(payload) {
    if (!payload) return false;
    var applied = false;
    if (payload.accessToken) {
      setToken(payload.accessToken);
      applied = true;
    }
    if (payload.refreshToken) {
      setRefreshToken(payload.refreshToken);
    }
    return applied;
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

  http.refresh = function (refreshToken) {
    return http.request({
      method: 'POST',
      url: '/refresh.json',
      data: { refreshToken: refreshToken || getRefreshToken() }
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

    if (url.indexOf('/login.json') > -1 || url.indexOf('/refresh.json') > -1) {
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

    if (url.indexOf('/login.json') > -1 || url.indexOf('/refresh.json') > -1 || config.skipAuthIntercept) {
      throw error;
    }

    if (status === 401 || code === 401) {
      console.log('[layui-request] JWT intercepted: 401', {
        url: url,
        status: status,
        code: code
      });

      if (config._jwtRetried) {
        throw error;
      }

      config._jwtRetried = true;
      config._originalError = error;

      var refreshToken = getRefreshToken();
      if (!refreshToken) {
        removeToken();
        throw error;
      }

      return http.refresh(refreshToken).then(function (response) {
        var data = payloadOf(response);
        applyTokens(data);
        return http.request(config);
      }).catch(function (refreshError) {
        removeToken();
        removeRefreshToken();
        throw refreshError;
      });
    }

    if (status === 403 || code === 403) {
      console.log('[layui-request] JWT intercepted: 403', {
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
  http.setRefreshToken = setRefreshToken;
  http.getRefreshToken = getRefreshToken;
  http.removeRefreshToken = removeRefreshToken;
  http.clearAuth = function () {
    removeToken();
    removeRefreshToken();
    return http;
  };
  http.setInvalidToken = setInvalidToken;
  http.setExpiredToken = setExpiredToken;
  http.parseJWT = parseJWT;
  http.tokenStatus = tokenStatus;
  http.payloadOf = payloadOf;
  http.applyTokens = applyTokens;
  http.setAuthorization = setToken;
  http.getAuthorization = getToken;
  http.removeAuthorization = removeToken;

  exports('http', http);
});
