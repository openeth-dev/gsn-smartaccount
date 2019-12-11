const path = require('path')
// BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

console.log('env=', process.env.PROD)
let mode
if (process.env.PROD) {
  mode = 'production'
} else {
  mode = 'development'
}

module.exports = {
  plugins: [
    //      new BundleAnalyzerPlugin()
  ],

  entry: './src/js/iframe/AccountFrame.js',
  mode,
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'public/pack'),
    filename: 'account.pack.js'
  }
}

console.log('config: ', module.exports)
