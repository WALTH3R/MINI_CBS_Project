// Empty apiBaseUrl -> every API call is a relative /api/... request, resolved against whatever
// origin served the page. Pairs with docker/nginx.conf, which proxies /api, /admin, /api-auth,
// and /static through to the backend container on the same origin — so this build works
// identically whether it's opened from the host browser or crawled by a container-based scanner.
export const environment = {
  production: false,
  apiBaseUrl: '',
};
