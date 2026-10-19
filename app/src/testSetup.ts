import { vi } from 'vitest';

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

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Path: 'Path',
  Line: 'Line',
  Rect: 'Rect',
  Polyline: 'Polyline',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialIcons: 'MaterialIcons',
  FontAwesome: 'FontAwesome',
  Feather: 'Feather',
}));

vi.mock('react-native-purchases', () => ({
  default: {
    configure: vi.fn(),
    logIn: vi.fn(),
    logOut: vi.fn(),
    getOfferings: vi.fn(),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
    getCustomerInfo: vi.fn(),
  },
  PRORATION_MODE: {
    IMMEDIATE_WITH_TIME_PRORATION: 1,
    DEFERRED: 2,
  },
}));
