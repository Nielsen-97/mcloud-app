module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest/setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|@react-native-community|@react-native-async-storage|@react-native-camera-roll)/)',
  ],
};
