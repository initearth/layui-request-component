export interface CancelSource {
  signal: any;
  cancel(reason?: unknown): void;
}

export function createCancelSource(): CancelSource {
  const state = { aborted: false, reason: undefined as unknown };
  const listeners: Array<() => void> = [];
  const signal: any = {};

  Object.defineProperty(signal, 'aborted', {
    enumerable: true,
    get: function () { return state.aborted; }
  });

  Object.defineProperty(signal, 'reason', {
    enumerable: true,
    get: function () { return state.reason; }
  });

  signal.addEventListener = function (type: string, listener: () => void) {
    if (type === 'abort' && typeof listener === 'function' && listeners.indexOf(listener) === -1) {
      listeners.push(listener);
    }
  };

  signal.removeEventListener = function (type: string, listener: () => void) {
    if (type !== 'abort') return;
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };

  return {
    signal: signal,
    cancel: function (reason?: unknown) {
      if (state.aborted) return;
      state.aborted = true;
      state.reason = reason;
      listeners.slice().forEach(function (listener) {
        try {
          listener();
        } catch (e) {}
      });
    }
  };
}
