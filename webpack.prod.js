var path = require('path');
var webpack = require('webpack');
var CleanWebpackPlugin = require('clean-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    devtool: "inline-source-map",
    module: {
        rules: [{
                test: /\.tsx?$/,
                use: [{
                        loader: 'ts-loader'
                    }],
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ExtractTextPlugin.extract(["css-loader"])
            },
            {
                test: /\.scss$/,
                use: ExtractTextPlugin.extract([{
                    loader: "css-loader" // translates CSS into CommonJS
                }, {
                    loader: "sass-loader", // compiles Sass to CSS
                    options: {
                        includePaths: [path.resolve(__dirname, "./node_modules")]
                    }
                }])
            },
            {
                test: /\.(woff(2)?|ttf|eot|)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: "file-loader?name=[name].[ext]&outputPath=main/assets/fonts/"
            },
            {
                test: /\.(svg|png)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: "file-loader?name=[name].[ext]&outputPath=main/assets/images/"
            }
 
        ]
    },
    plugins: [
        new webpack.DefinePlugin({
            BLE_CONFIG: '"prod"',
            ENV_CONFIG: '"prod"',
            FS_CONFIG: '"prod"'
        }),
        new CleanWebpackPlugin([
            path.join(__dirname, "www")
        ]),
        new CleanWebpackPlugin([
            path.join(__dirname, "dist")
        ]),
        new ExtractTextPlugin('[name].css'),
        new CopyWebpackPlugin([
            {from: 'bundled_firmware/*.script'},
            {from: 'bundled_firmware/*.json'}
        ])
    ]
};
