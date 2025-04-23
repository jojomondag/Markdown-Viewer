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
      '@lezer/common': path.resolve(__dirname, 'node_modules/@lezer/common'),
      '@lezer/highlight': path.resolve(__dirname, 'node_modules/@lezer/highlight'),
      '@lezer/lr': path.resolve(__dirname, 'node_modules/@lezer/lr'),
      '@lezer/html': path.resolve(__dirname, 'src/mocks/html-parser-mock.js'),
      '@lezer/markdown': path.resolve(__dirname, 'node_modules/@lezer/markdown'),
      '@codemirror/state': path.resolve(__dirname, 'node_modules/@codemirror/state'),
      '@codemirror/view': path.resolve(__dirname, 'node_modules/@codemirror/view'),
      '@codemirror/language': path.resolve(__dirname, 'node_modules/@codemirror/language'),
      '@codemirror/lang-html': path.resolve(__dirname, 'src/mocks/lang-html-mock.js'),
      '@codemirror/lang-markdown': path.resolve(__dirname, 'node_modules/@codemirror/lang-markdown')
    }
  },
  devtool: 'source-map'
}; 