var merge = require('webpack-merge');

module.exports = function(env) {
    env = env || 'dev';

    let base = require('./webpack.base.js');
    let addOn = require(`./webpack.${env}.js`);

    let conf = merge.strategy({
        'module.rules': 'replace'
    })(base, addOn);

    return conf;
}