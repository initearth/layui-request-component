import { $ } from './layui';

export function createInterceptorManager(): any {
  let handlers: Record<number, any> = {};
  let index = 0;

  return {
    use: function (onFulfilled?: any, onRejected?: any): number {
      const id = ++index;
      handlers[id] = {
        id: id,
        onFulfilled: onFulfilled,
        onRejected: onRejected
      };
      return id;
    },

    eject: function (id: number): void {
      delete handlers[id];
    },

    clear: function (): void {
      handlers = {};
    },

    _handlers: function (): any[] {
      const list: any[] = [];
      for (const key in handlers) {
        if (handlers.hasOwnProperty(key)) list.push(handlers[key]);
      }
      return list.sort(function (a, b) { return a.id - b.id; });
    }
  };
}

export function runInterceptorChain(
  manager: any,
  value: any,
  context: any,
  isRequest: boolean
): Promise<any> {
  let chain = Promise.resolve(value);

  $.each(manager._handlers(), function (_: number, item: any) {
    chain = chain.then(function (current) {
      if (typeof item.onFulfilled !== 'function') return current;
      return item.onFulfilled.call(undefined, current, {
        operation: context.operation,
        config: isRequest ? current : (current && current.config),
        client: context.client,
        owner: context.owner
      });
    }, function (error) {
      if (typeof item.onRejected !== 'function') throw error;
      return item.onRejected.call(undefined, error);
    });
  });

  return chain;
}

export function interceptorProxy(getClient: () => any, kind: 'request' | 'response'): any {
  return {
    use: function () {
      const manager = getClient().interceptors[kind];
      return manager.use.apply(manager, arguments);
    },
    eject: function () {
      const manager = getClient().interceptors[kind];
      return manager.eject.apply(manager, arguments);
    },
    clear: function () {
      const manager = getClient().interceptors[kind];
      return manager.clear.apply(manager, arguments);
    }
  };
}
