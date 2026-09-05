const DEFAULT_TIMEOUT_MS = 10000;
export const API_BASE_URL = process.env.REACT_APP_EDGE_SERVER_ENDPOINT || '/api';

let getToken = () => null;
let onUnauthorized = () => {};

const defaults = {
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
};

export const configureApiAuth = ({ token, unauthorized }) => {
  getToken = token;
  onUnauthorized = unauthorized;
  return () => {
    getToken = () => null;
    onUnauthorized = () => {};
  };
};

const resolveRequestUrl = (input, baseURL = defaults.baseURL) => {
  const isRequest = typeof Request !== 'undefined' && input instanceof Request;
  const value = isRequest ? input.url : String(input);
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return value;

  const base = String(baseURL || '').replace(/\/$/, '');
  if (!base || value === base || value.startsWith(`${base}/`)) return value;
  return `${base}/${value.replace(/^\//, '')}`;
};

const addParams = (url, params) => {
  if (!params) return url;
  const [path, existing = ''] = url.split('?');
  const query = new URLSearchParams(existing);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query.set(key, value);
  });
  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
};

export const apiFetch = async (input, options = {}) => {
  const {
    baseURL,
    params,
    timeout = defaults.timeout,
    signal: callerSignal,
    ...fetchOptions
  } = options;
  const isRequest = typeof Request !== 'undefined' && input instanceof Request;
  const inputUrl = isRequest ? input.url : String(input);
  const url = addParams(resolveRequestUrl(input, baseURL), params);
  const headers = new Headers(fetchOptions.headers || (isRequest ? input.headers : undefined));
  const token = getToken();
  const isExternalUrl = /^[a-z][a-z0-9+.-]*:/i.test(inputUrl)
    && !inputUrl.startsWith(String(baseURL || '').replace(/\/$/, ''));
  if (token && !isExternalUrl && !url.endsWith('/auth/login') && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = callerSignal ? null : new AbortController();
  const timeoutId = controller && timeout > 0
    ? setTimeout(() => controller.abort(), timeout)
    : null;

  try {
    const response = await window.fetch(url, {
      ...fetchOptions,
      headers,
      signal: callerSignal || controller?.signal,
    });
    if (response.status === 401 && !url.endsWith('/auth/login')) onUnauthorized();
    return response;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const parseResponse = async (response, responseType) => {
  if (responseType === 'text') return response.text();
  if (responseType === 'blob') return response.blob();
  if (responseType === 'arraybuffer') return response.arrayBuffer();
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!text) return null;
  if (!contentType.includes('json')) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async (url, config = {}) => {
  const { data, responseType, validateStatus, ...options } = config;
  const headers = new Headers(options.headers || {});
  let body = data;
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && data instanceof Blob;
  if (data != null && !isFormData && !isBlob && typeof data !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(data);
  }

  let response;
  try {
    response = await apiFetch(url, { ...options, headers, body });
  } catch (cause) {
    const error = new Error(cause.name === 'AbortError' ? 'Request timed out' : cause.message);
    error.cause = cause;
    error.config = { url, ...config };
    throw error;
  }

  const responseData = await parseResponse(response, responseType);
  const result = {
    data: responseData,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    config: { url, ...config },
  };
  const accepted = validateStatus ? validateStatus(response.status) : response.ok;
  if (!accepted) {
    const error = new Error(responseData?.error || `${response.status} ${response.statusText}`);
    error.response = result;
    error.config = result.config;
    throw error;
  }
  return result;
};

export const api = {
  defaults,
  request,
  get: (url, config) => request(url, { ...config, method: 'GET' }),
  delete: (url, config) => request(url, { ...config, method: 'DELETE' }),
  post: (url, data, config) => request(url, { ...config, method: 'POST', data }),
  put: (url, data, config) => request(url, { ...config, method: 'PUT', data }),
  patch: (url, data, config) => request(url, { ...config, method: 'PATCH', data }),
};

export default api;
