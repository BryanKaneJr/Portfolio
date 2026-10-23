import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000';

// Local dev fallback URLs come back as `/uploads/...`. Resolve them against
// the API base so <Image source={{ uri }}> can actually load them.
export const absUrl = (u) => {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return API_URL + (u.startsWith('/') ? u : '/' + u);
};

const request = async (path, { method = 'GET', body, auth = true, headers = {}, raw = null } = {}) => {
    const finalHeaders = { ...headers };
    if (!raw) finalHeaders['Content-Type'] = 'application/json';
    if (auth) {
        const token = await AsyncStorage.getItem('token');
        if (token) finalHeaders.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: finalHeaders,
        body: raw ? raw : (body ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    const data = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : {};
    if (!res.ok) {
        const err = new Error(data.error || `http_${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
};

// Upload a local file to whatever URL /profile/upload-url gave us.
// - S3 signed URL: PUT the bytes with the right Content-Type.
// - Local dev sink: POST the bytes to /uploads/... with auth header.
export const uploadFile = async (localUri, presign) => {
    const res = await fetch(localUri);
    const blob = await res.blob();
    if (presign.mode === 's3') {
        const put = await fetch(presign.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': presign.contentType || 'image/jpeg' },
            body: blob,
        });
        if (!put.ok) throw new Error('upload_failed');
    } else {
        // Local dev sink is auth-required, so route via request().
        await request(presign.uploadUrl, {
            method: 'POST',
            raw: blob,
            headers: { 'Content-Type': presign.contentType || 'application/octet-stream' },
        });
    }
    return presign.publicUrl;
};

export const api = {
    get: (p, opts) => request(p, opts),
    post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
    patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
    del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
};
export { API_URL };
