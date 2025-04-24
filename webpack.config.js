const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    main: './src/main.jsx'
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'build'),
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    fallback: {
      "path": require.resolve("path-browserify"),
      "fs": false,
      "os": false,
      "crypto": false
    },
    alias: {
      '@lezer/html': path.resolve(__dirname, 'src/mocks/html-parser-mock.js'),
      '@codemirror/lang-html': path.resolve(__dirname, 'src/mocks/lang-html-mock.js'),
    }
  },
  devtool: 'source-map'
}; 