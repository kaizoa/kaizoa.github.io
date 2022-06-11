/* eslint-disable */
'use strict';

require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
    target: 'esnext',
  },
});

require('./src/__generated__/gatsby-types');

const {
  onPreBootstrap,
  onCreateNode,
  createPages,
  createSchemaCustomization,
} = require('./src/gatsby-node');

exports.onPreBootstrap = onPreBootstrap;
exports.onCreateNode = onCreateNode;
exports.createPages = createPages;
exports.createSchemaCustomization = createSchemaCustomization;
