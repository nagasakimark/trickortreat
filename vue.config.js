module.exports = {
  baseUrl: process.env.NODE_ENV === 'production'
    ? '/trickortreat/'
    : '/',
  devServer: {
    disableHostCheck: true // Reference: https://github.com/vuejs-templates/webpack/issues/1205
  }
}
