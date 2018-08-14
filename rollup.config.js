import babel from 'rollup-plugin-babel';
import json from 'rollup-plugin-json';
import includePaths from 'rollup-plugin-includepaths';

const {dependencies} = require('./package.json');

export default {
  input: 'lib/quiq-chat.js',
  plugins: [
    json(),
    babel({exclude: 'node_modules/**'}),
    includePaths({paths:['src']}),
  ],
  external: Object.keys(dependencies),
  output: {
    name: "QuiqChatClient",
    file: 'dist/quiq-chat.js',
    format: 'umd',
  }
};
