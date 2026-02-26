module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Prevent "Cannot use import.meta outside a module" on web bundles
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
