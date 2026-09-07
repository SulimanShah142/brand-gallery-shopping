const {
  withMainApplication,
  createRunOncePlugin,
} = require('expo/config-plugins');

const PACKAGE_IMPORT =
  'import ai.onnxruntime.reactnative.OnnxruntimePackage';

function withOnnxruntime(config) {
  return withMainApplication(config, (config) => {
    let contents =
      config.modResults.contents;

    // --------------------------------------------------------
    // IMPORT
    // --------------------------------------------------------

    if (
      !contents.includes(
        PACKAGE_IMPORT
      )
    ) {
      const lastImportIndex =
        contents.lastIndexOf(
          '\nimport '
        );

      if (
        lastImportIndex !== -1
      ) {
        const endOfLine =
          contents.indexOf(
            '\n',
            lastImportIndex + 1
          );

        contents =
          contents.slice(
            0,
            endOfLine + 1
          ) +
          PACKAGE_IMPORT +
          '\n' +
          contents.slice(
            endOfLine + 1
          );
      }
    }

    // --------------------------------------------------------
    // PACKAGE REGISTRATION
    // --------------------------------------------------------

    if (
      !contents.includes(
        'OnnxruntimePackage()'
      )
    ) {
      const marker =
        '// add(MyReactNativePackage())';

      const markerIndex =
        contents.indexOf(
          marker
        );

      if (
        markerIndex !== -1
      ) {
        const endOfMarkerLine =
          contents.indexOf(
            '\n',
            markerIndex
          );

        contents =
          contents.slice(
            0,
            endOfMarkerLine
          ) +
          '\n          add(OnnxruntimePackage())' +
          contents.slice(
            endOfMarkerLine
          );
      }
    }

    config.modResults.contents =
      contents;

    return config;
  });
}

module.exports =
  createRunOncePlugin(
    withOnnxruntime,
    'with-onnxruntime',
    '1.0.0'
  );