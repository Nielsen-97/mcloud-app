/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    getPhotos: jest.fn().mockResolvedValue({ edges: [], page_info: { has_next_page: false } }),
    saveAsset: jest.fn(),
  },
}));

jest.mock('react-native-background-fetch', () => ({
  configure: jest.fn(),
  finish: jest.fn(),
  NETWORK_TYPE_ANY: 0,
}));

jest.mock('react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  downloadFile: jest.fn(() => ({ promise: Promise.resolve() })),
}));

jest.mock('react-native-share', () => ({
  open: jest.fn(),
}));

jest.mock('react-native-file-viewer', () => ({
  open: jest.fn(),
}));

jest.mock('react-native-video', () => 'Video');

jest.mock('@preeternal/react-native-cookie-manager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({})),
    set: jest.fn(),
    getAll: jest.fn(() => Promise.resolve({})),
    clearAll: jest.fn(),
    clearByName: jest.fn(),
    flush: jest.fn(),
    removeSessionCookies: jest.fn(),
    setFromResponse: jest.fn(),
    getFromResponse: jest.fn(() => Promise.resolve({})),
  },
}));

jest.mock('../src/services/serverUrl', () => ({
  LOCAL_URL: 'http://192.168.8.142',
  REMOTE_URL: 'https://mcloud.taile49ac8.ts.net',
  getServerUrl: jest.fn(() => 'https://mcloud.taile49ac8.ts.net'),
  resolveServerUrl: jest.fn(() => Promise.resolve('https://mcloud.taile49ac8.ts.net')),
  subscribeServerUrl: jest.fn(() => () => {}),
}));
