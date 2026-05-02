import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000';

const request = async (path, { method = 'GET', body, auth = true, headers = {} } = {}) => {
    const finalHeaders = { 'Content-Type': 'application/json', ...headers };
    if (auth) {
        const token = await AsyncStorage.getItem('token');
        if (token) finalHeaders.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: finalHeaders,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
        const err = new Error(data.error || `http_${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
};

export const api = {
    get: (p, opts) => request(p, opts),
    post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
    patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
    del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
};
export { API_URL };
