const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// This tells Metro to look at the 'exports' field in package.json
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
