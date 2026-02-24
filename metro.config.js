// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force CJS resolution to avoid import.meta.env in ESM builds (e.g. zustand)
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

module.exports = config;
