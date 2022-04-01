var path = require('path');
var webpack = require('webpack');

module.exports = {
    plugins: [
        new webpack.SourceMapDevToolPlugin({
            filename: null, // if no value is provided the sourcemap is inlined
            test: /\.(ts|js)($|\?)/i, // process .js and .ts files only
            exclude: [/node_modules/]
        }),
        new webpack.DefinePlugin({
            BLE_CONFIG: '"karmatest"',
            ENV_CONFIG: '"proxy"',
            FS_CONFIG: '"mock"'
        })
    ]
};
