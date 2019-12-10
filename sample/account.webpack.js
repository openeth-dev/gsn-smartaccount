const path = require('path');
//BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

module.exports = {
  plugins: [
//      new BundleAnalyzerPlugin()
  ],

  entry: './src/js/iframe/AccountFrame.js',
  devtool: 'source-map',
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'public/pack'),
    filename: 'account.pack.js'
  }
};
