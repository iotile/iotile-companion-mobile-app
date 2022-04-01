var path = require('path');
var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');
var fs = require('fs');
var et = require('elementtree');
var execSync = require('child_process').execSync;
/* 
 * These functions extract the version number and git commit number
 * to create a unique version number that is embedded in the APP
 * as X.Y.Z.`git rev-list --count HEAD`.
 */
function parseElementtreeSync(filename) {
    var contents = fs.readFileSync(filename, 'utf-8');
    if (contents) {
        //Windows is the BOM. Skip the Byte Order Mark.
        contents = contents.substring(contents.indexOf('<'));
    }

    return new et.ElementTree(et.XML(contents));
}

function getSemanticVersion() {
    let xml = parseElementtreeSync(path.join(__dirname, 'config.xml'));
    let widget = xml.getroot();
    let version = widget.get("version");

    return version;
}

function getVersion() {
    let version = getSemanticVersion();
    let commitCount = execSync('git rev-list --count HEAD');

    return version + "." + commitCount.toString().trim();
}

let version = '"' + getVersion() + '"';
let semVer = '"' + getSemanticVersion() + '"';

module.exports = {
    entry: {
        app: [
            './app/app.ts'
        ]
    },
    output: {
        filename: '[name].js',
        path: path.join(__dirname, "www/"),
        sourceMapFilename: '[name].map'
    },
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
                use: [{
                    loader: "style-loader" // creates style nodes from JS strings
                }, {
                    loader: "css-loader" // translates CSS into CommonJS
                }]
            },
            {
                test: /\.scss$/,
                use: [{
                    loader: "style-loader" // creates style nodes from JS strings
                }, {
                    loader: "css-loader" // translates CSS into CommonJS
                }, {
                    loader: "sass-loader", // compiles Sass to CSS
                    options: {
                        includePaths: [path.resolve(__dirname, "./node_modules")]
                    }
                }]
            },
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: "url-loader?limit=10000&mimetype=application/font-woff"
            },
            {
                test: /\.(ttf|eot|svg|png)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: "file-loader"
            }
        ]
    },
    plugins: [
        new webpack.optimize.CommonsChunkPlugin({
            name: 'vendor',
            filename: 'vendor.js',
            minChunks(module, count) {
                var context = module.context;
                return context && context.indexOf('node_modules') >= 0;
            },
        }),
        new HtmlWebpackPlugin({
            template: 'app/index.html',
            inject: false
        }),
        new CopyWebpackPlugin([{
            from: "main/**/*.html",
            context: "app"
        }]),
        new webpack.DefinePlugin({
            IOTILE_VERSION_AND_BUILD: version,
            IOTILE_VERSION: semVer
        })
    ],
    resolve: {
        extensions: [".tsx", ".ts", ".js", ".json"],
        modules: ['app/packages', 'node_modules'],
        alias: {
            'typescript-logging': path.resolve('./node_modules/typescript-logging'),
            'msgpack-lite': path.resolve('./node_modules/msgpack-lite'),
            '@iotile/iotile-common': path.resolve('./node_modules/@iotile/iotile-common')
        }
    }
};