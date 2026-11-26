/**
 * layui - layui 模块初始化与调试日志能力
 */
layui.config({
  base: './'
}).use(['http', 'layer', 'util', 'laytpl'], function () {
  var util = layui.util;
  var laytpl = layui.laytpl;

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
    layui.$('#console').append(consoleTpl.render({
      type: type,
      time: util.toDateString(new Date(), 'HH:mm:ss'),
      text: text
    }));

    var box = layui.$('#console')[0];
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

  window.LayuiDebug = {
    $: layui.$,
    layer: layui.layer,
    http: layui.http,
    util: util,
    stringify: safeStringify
  };

  if (typeof window.onLayuiReady === 'function') {
    window.onLayuiReady(window.LayuiDebug);
  }
});
