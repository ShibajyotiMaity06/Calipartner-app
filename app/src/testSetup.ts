// Setup for vitest in Node environment

interface GlobalWithExpo {
  expo?: {
    EventEmitter: unknown;
    modules: unknown;
  };
  __DEV__?: boolean;
}

const g = globalThis as unknown as GlobalWithExpo;

if (typeof g.expo === 'undefined') {
  const dummyModule = new Proxy(
    {},
    {
      get: () => () => Promise.resolve(null),
    },
  );

  g.expo = {
    EventEmitter: class {
      addListener() {
        return { remove: () => {} };
      }
      removeListener() {}
      removeAllListeners() {}
      emit() {}
    },
    modules: new Proxy(
      {},
      {
        get: () => dummyModule,
      },
    ),
  };
}

if (typeof g.__DEV__ === 'undefined') {
  g.__DEV__ = true;
}

if (typeof process !== 'undefined' && !process.env.EXPO_OS) {
  process.env.EXPO_OS = 'web';
}
