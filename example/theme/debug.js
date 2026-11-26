/**
 * debug - JWT 验证调试页交互逻辑
 */
(function () {
  function initDebug(ctx) {
    var $ = ctx.$;
    var layer = ctx.layer;
    var http = ctx.http;
    var util = ctx.util;
    var countdownTimer = null;

    function shortToken(value, head, tail) {
      var token = value || '';
      if (!token) return '--';
      if (token.length <= (head + tail)) return token;
      return token.slice(0, head) + ' ... ' + token.slice(-tail);
    }

    function setState($el, state) {
      $el.attr('data-state', state || 'empty');
    }

    function renderTokenStatus() {
      var accessToken = http.getToken();
      var refreshToken = http.getRefreshToken();
      var accessStatus = http.tokenStatus(accessToken);
      var refreshStatus = http.tokenStatus(refreshToken);
      var badgeText = '未登录';
      var badgeState = 'empty';

      if (accessStatus.state === 'valid') {
        badgeText = 'JWT 有效';
        badgeState = 'valid';
      } else if (accessStatus.state === 'expired') {
        badgeText = 'JWT 已过期';
        badgeState = 'expired';
      } else if (accessStatus.decoded) {
        badgeText = 'JWT 异常';
        badgeState = 'invalid';
      }

      $('#token-badge').text(badgeText);
      setState($('#token-badge'), badgeState);

      $('#access-token').text(shortToken(accessToken, 48, 32));
      $('#access-status').text(accessStatus.state === 'valid' ? '有效' :
        accessStatus.state === 'expired' ? '已过期' :
          accessStatus.decoded ? '异常' : '未登录');
      setState($('#access-status'), accessStatus.state === 'valid' ? 'valid' :
        accessStatus.state === 'expired' ? 'expired' :
          accessStatus.decoded ? 'invalid' : 'empty');
      $('#access-meta').text(accessStatus.message);

      $('#refresh-token').text(shortToken(refreshToken, 48, 32));
      $('#refresh-status').text(refreshStatus.state === 'valid' ? '有效' :
        refreshStatus.state === 'expired' ? '已过期' :
          refreshStatus.decoded ? '异常' : '未登录');
      setState($('#refresh-status'), refreshStatus.state === 'valid' ? 'valid' :
        refreshStatus.state === 'expired' ? 'expired' :
          refreshStatus.decoded ? 'invalid' : 'empty');
      $('#refresh-meta').text(refreshStatus.message);

      var countdown = $('#token-countdown');
      if (accessStatus.state === 'valid') {
        countdown.text('剩余 ' + accessStatus.secondsLeft + 's');
        setState(countdown, 'valid');
      } else {
        countdown.text('--');
        setState(countdown, accessStatus.state);
      }

      renderJWT(accessStatus.decoded);
    }

    function renderJWT(decoded) {
      if (!decoded) {
        $('#jwt-header').text('--');
        $('#jwt-payload').text('--');
        $('#jwt-signature').text('--');
        $('#claims-exp').text('exp -');
        setState($('#claims-exp'), 'empty');
        return;
      }

      $('#jwt-header').text(JSON.stringify(decoded.header, null, 2));
      $('#jwt-payload').text(JSON.stringify(decoded.payload, null, 2));
      $('#jwt-signature').text(shortToken(decoded.signature, 32, 16));

      var exp = decoded.payload && decoded.payload.exp;
      if (exp) {
        $('#claims-exp').text('exp ' + util.toDateString(new Date(exp * 1000), 'yyyy-MM-dd HH:mm:ss'));
        setState($('#claims-exp'), exp * 1000 > Date.now() ? 'valid' : 'expired');
      } else {
        $('#claims-exp').text('exp -');
        setState($('#claims-exp'), 'empty');
      }
    }

    function showResponse(response) {
      $('#response').text(ctx.stringify(response));
    }

    function request(task, onSuccess) {
      $('#status').attr('data-state', 'loading').text('请求中');
      $('#response').text('请求中...');

      var promise = typeof task === 'function' ? task() : task;

      promise.then(function (response) {
        renderTokenStatus();
        $('#status').attr('data-state', 'success').text(response.statusCode);
        showResponse(response);
        if (onSuccess) onSuccess(response);
      }).catch(function (error) {
        renderTokenStatus();
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

    function markStep(step) {
      $('.flow-steps li').removeClass('active');
      $('.flow-steps li[data-step="' + step + '"]').addClass('active');
    }

    $('#btn-login').on('click', function () {
      request(function () { return http.login(); }, function (response) {
        var payload = responseData(response);
        http.applyTokens(payload);
        renderTokenStatus();
        markStep('sign');
        console.log('[layui-request] JWT issued:', {
          accessToken: http.getToken(),
          refreshToken: http.getRefreshToken()
        });
        layer.msg('登录成功，JWT 双 Token 已保存', { icon: 1 });
      });
    });

    $('#btn-parse').on('click', function () {
      var status = http.tokenStatus(http.getToken());
      renderTokenStatus();
      if (status.decoded) {
        showResponse(status.decoded);
        layer.msg('JWT 解析成功', { icon: 1 });
      } else {
        showResponse({ error: status.message });
        layer.msg(status.message, { icon: 2 });
      }
    });

    $('#btn-expired').on('click', function () {
      http.setExpiredToken();
      renderTokenStatus();
      console.log('[layui-request] expired JWT set');
      layer.msg('已模拟 exp 过期的 JWT，点击「过期自动刷新」测试', { icon: 1 });
    });

    $('#btn-invalid').on('click', function () {
      http.setInvalidToken();
      renderTokenStatus();
      console.log('[layui-request] invalid-signature JWT set');
      layer.msg('已模拟签名错误的 JWT', { icon: 1 });
    });

    $('#btn-clear').on('click', function () {
      http.clearAuth();
      renderTokenStatus();
      console.log('[layui-request] JWT cleared');
      layer.msg('Access / Refresh Token 已清除', { icon: 1 });
    });

    $('#btn-auth').on('click', function () {
      markStep('inject');
      request(function () { return http.checkAuth({ skipAuthIntercept: true }); }, function (response) {
        var payload = responseData(response);
        markStep('verify');
        layer.msg(payload && payload.valid ? 'JWT 校验通过' : 'JWT 校验未通过', {
          icon: payload && payload.valid ? 1 : 2
        });
      });
    });

    $('#btn-auth-401').on('click', function () {
      http.setExpiredToken();
      renderTokenStatus();
      console.log('[layui-request] 401 refresh test started');

      request(function () { return http.checkAuth(); }, function (response) {
        var payload = responseData(response);
        var original = response.config && response.config._originalError;

        if (original) {
          showResponse({
            original: {
              statusCode: original.statusCode,
              code: original.code,
              message: original.message
            },
            refreshed: {
              accessToken: http.getToken()
            },
            result: response
          });
        }

        markStep('refresh');
        layer.msg(
          payload && payload.valid ? '401 → refresh → 重试成功' : 'JWT 校验未通过',
          { icon: payload && payload.valid ? 1 : 2 }
        );
      });
    });

    $('#btn-refresh').on('click', function () {
      request(function () { return http.refresh(); }, function (response) {
        var payload = responseData(response);
        http.applyTokens(payload);
        renderTokenStatus();
        markStep('refresh');
        layer.msg('Access Token 已刷新', { icon: 1 });
      });
    });

    $('#btn-auth-403').on('click', function () {
      console.log('[layui-request] 403 test started');
      request(function () { return http.checkForbidden(); });
    });

    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(renderTokenStatus, 1000);

    renderTokenStatus();
  }

  if (window.LayuiDebug) {
    initDebug(window.LayuiDebug);
  } else {
    window.onLayuiReady = initDebug;
  }
})();
