/**
 * debug - 鉴权调试页交互逻辑
 */
(function () {
  function initDebug(ctx) {
    var $ = ctx.$;
    var layer = ctx.layer;
    var http = ctx.http;

    function refreshToken() {
      var token = typeof http.getToken === 'function' ? http.getToken() : '';

      if (!token && http.config && http.config.auth) {
        token = layui.data(http.config.auth.table)[http.config.auth.key] || '';
      }

      $('#token').val(token || '');
      return token;
    }

    function showResponse(response) {
      $('#response').text(ctx.stringify(response));
    }

    function request(task, onSuccess) {
      $('#status').attr('data-state', 'loading').text('请求中');
      $('#response').text('请求中...');

      var promise = typeof task === 'function' ? task() : task;

      promise.then(function (response) {
        refreshToken();
        $('#status').attr('data-state', 'success').text(response.statusCode);
        showResponse(response);
        if (onSuccess) onSuccess(response);
      }).catch(function (error) {
        refreshToken();
        $('#status').attr('data-state', 'error').text(error.statusCode || error.code);
        showResponse(error.toJSON ? error.toJSON() : error);
        layer.msg('请求失败：' + error.code, { icon: 2 });
      });
    }

    function responseData(response) {
      return response && response.data && response.data.data
        ? response.data.data
        : response && response.data;
    }

    $('#btn-login').on('click', function () {
      request(function () { return http.login(); }, function (response) {
        var payload = responseData(response);

        if (payload && payload.token) {
          http.setToken(payload.token);
          refreshToken();
          console.log('[layui-request] token saved:', http.getToken());
          layer.msg('登录成功，Token 已自动保存', { icon: 1 });
        } else {
          layer.msg('登录响应中没有 token', { icon: 2 });
        }
      });
    });

    $('#btn-invalid-token').on('click', function () {
      http.setInvalidToken();
      refreshToken();
      console.log('[layui-request] token set invalid:', http.getToken());
      layer.msg('已设置错误 Token，可测试 401 拦截', { icon: 1 });
    });

    $('#btn-auth').on('click', function () {
      request(function () { return http.checkAuth({ skipAuthIntercept: true }); }, function (response) {
        var payload = responseData(response);
        var valid = !!(payload && payload.valid);

        layer.msg(valid ? '鉴权通过' : '鉴权未通过', { icon: valid ? 1 : 2 });
      });
    });

    $('#btn-auth-401').on('click', function () {
      http.setInvalidToken();
      refreshToken();
      console.log('[layui-request] 401 test started');

      request(function () { return http.checkAuth(); }, function (response) {
        var payload = responseData(response);
        var valid = !!(payload && payload.valid);
        var original = response.config && response.config._originalError;

        if (original) {
          showResponse({
            original: {
              statusCode: original.statusCode,
              code: original.code,
              message: original.message
            },
            retried: response
          });
        }

        layer.msg(
          valid ? '401 已自动拦截，重新登录并重试成功' : '鉴权未通过',
          { icon: valid ? 1 : 2 }
        );
      });
    });

    $('#btn-auth-403').on('click', function () {
      console.log('[layui-request] 403 test started');
      request(function () { return http.checkForbidden(); });
    });

    $('#btn-clear-token').on('click', function () {
      http.removeToken();
      refreshToken();
      console.log('[layui-request] token cleared');
      layer.msg('Token 已清除', { icon: 1 });
    });

    refreshToken();
  }

  if (window.LayuiDebug) {
    initDebug(window.LayuiDebug);
  } else {
    window.onLayuiReady = initDebug;
  }
})();
