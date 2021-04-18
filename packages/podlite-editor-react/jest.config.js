
module.exports = {
  preset: 'ts-jest',
  transformIgnorePatterns: ['/node_modules/(?!dagre-d3-renderer/lib).*\\.js'],
  "bail": true,
  "verbose": true
};
