const path = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    main: './src/main.jsx'
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'build'),
    publicPath: './',
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
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              svgoConfig: {
                plugins: [
                  {
                    name: 'preset-default',
                    params: {
                      overrides: {
                        removeViewBox: false,
                      },
                    },
                  },
                ],
              },
            },
          },
          'url-loader',
        ],
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
  devtool: 'source-map',
  plugins: [
    // Add the analyzer plugin; it runs only if ANALYZE env var is set
    process.env.ANALYZE ? new BundleAnalyzerPlugin({
      analyzerMode: 'json', // Output JSON instead of starting a server
      reportFilename: path.resolve(__dirname, 'build/stats.json'), // Specify output path
      openAnalyzer: false // Don't open the browser
    }) : null,
    // Copy icons to the build directory
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/Icons/MarkdownViewer.svg',
          to: 'src/Icons/MarkdownViewer.svg'
        },
        {
          from: 'assets/*.png',
          to: 'assets/[name][ext]'
        }
      ]
    })
  ].filter(Boolean), // Filter out null values if ANALYZE is not set
  // Add performance hints configuration
  performance: {
    hints: 'warning', // Show warnings for large bundles
    maxAssetSize: 900 * 1024, // Set max asset size to 900 KiB (in bytes)
    maxEntrypointSize: 900 * 1024, // Set max entrypoint size to 900 KiB (in bytes)
  }
}; 