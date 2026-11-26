layui.config({
  base: './'
}).use(['http', 'layer', 'util', 'laytpl'], function () {
  var $ = layui.$;
  var layer = layui.layer;
  var util = layui.util;
  var laytpl = layui.laytpl;
  var http = layui.http;

  var consoleTpl = laytpl(
    '<div class="console-line {{= d.type }}">' +
    '<span class="console-time">{{= d.time }}</span>' +
    '<span>{{= d.text }}</span>' +
    '</div>'
  );

  function safeStringify(value) {
    var seen = [];

    return JSON.stringify(value, function (key, item) {
      if (key === 'task' || key === 'elem' || key === 'xhr') return undefined;
      if (item && typeof item === 'object') {
        if (seen.indexOf(item) !== -1) return '[Circular]';
        seen.push(item);
      }
      return item;
    }, 2);
  }

  function formatArg(arg) {
    if (typeof arg === 'string') return arg;
    try {
      return safeStringify(arg);
    } catch (e) {
      return String(arg);
    }
  }

  function appendConsole(type, text) {
    $('#console').append(consoleTpl.render({
      type: type,
      time: util.toDateString(new Date(), 'HH:mm:ss'),
      text: text
    }));

    var box = $('#console')[0];
    box.scrollTop = box.scrollHeight;
  }

  layui.each(['log', 'error'], function (_index, type) {
    var original = console[type];
    console[type] = function () {
      var parts = [];
      layui.each(arguments, function (_itemIndex, arg) {
        parts.push(formatArg(arg));
      });

      var text = parts.join(' ');
      if (text.indexOf('[layui-request]') > -1) appendConsole(type, text);
      return original.apply(console, arguments);
    };
  });

  function refreshToken() {
    var token = typeof http.getToken === 'function' ? http.getToken() : '';

    if (!token && http.config && http.config.auth) {
      token = layui.data(http.config.auth.table)[http.config.auth.key] || '';
    }

    $('#token').val(token || '');
    return token;
  }

  function showResponse(response) {
    $('#response').text(safeStringify(response));
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
    request(function () { return http.checkAuth(); }, function (response) {
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
});
