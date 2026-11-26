var localBaseURL = window.location.protocol + '//' + window.location.host + '/example/mock';

window.APP_CONFIG = {
  debug: true,
  api: {
    baseURL: localBaseURL,
    timeout: 10000
  },
  auth: {
    table: 'auth',
    key: 'Authorization',
    prefix: 'Bearer ',
    accessKey: 'AccessToken',
    refreshKey: 'RefreshToken'
  }
};
