const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
    // Use default transformer
    experimentalImportSupport: false,
  
    inlineRequires: true,
  };

  // Reduce workers to prevent Jest pool exhaustion
  config.maxWorkers = 1;

module.exports = config;
