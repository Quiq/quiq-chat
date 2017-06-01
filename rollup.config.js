import flow from 'rollup-plugin-flow';
import babel from 'rollup-plugin-babel';

const {dependencies} = require('./package.json');

export default {
  entry: 'src/index.js',
  plugins: [flow({pretty: true}), babel({exclude: 'node_modules/**'})],
  external: Object.keys(dependencies),
  format: 'cjs',
  dest: 'build/quiq-chat.js',
};
