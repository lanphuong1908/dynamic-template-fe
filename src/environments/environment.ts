export const environment = {
  production: false,
  apiBaseUrl: '/client-api/v1',
  // Host IP for Document Server to access files
  // Can be overridden via environment variable HOST_IP
  hostIP: (typeof process !== 'undefined' && process.env['HOST_IP']) || 'localhost',
  onlyofficeServerUrl: (typeof process !== 'undefined' && process.env['ONLYOFFICE_SERVER_URL']) || 'http://localhost:8080'
};