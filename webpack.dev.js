var path = require('path');
var webpack = require('webpack');

module.exports = {
    devtool: 'cheap-module-eval-source-map',
    plugins: [
        new webpack.DefinePlugin({
            BLE_CONFIG: '"karmatest"',
            ENV_CONFIG: '"proxy"',
            FS_CONFIG: '"mock"'
        })
    ],
    devServer: {
        contentBase: path.join(__dirname, "www"),
        compress: true,
        port: 9001,
        proxy: {
           "/proxy/api/v1": {
                target: "localhost:8000",
                pathRewrite:{'^/proxy': ''},
                secure: false,
                changeOrigin: true
            },
            "/proxy_stage/api/v1": {
                target: "https://cloud.corp.archsys.io",
                pathRewrite:{'^/proxy_stage': ''},
                secure: false,
                changeOrigin: true
            },
            "/proxy_prod/api/v1": {
                target: "https://iotile.cloud",
                pathRewrite:{'^/proxy_prod': ''},
                secure: false,
                changeOrigin: true
            }
        }
    }
};
