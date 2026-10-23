// Push token registration. Called after successful login.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

export async function registerPushToken() {
    try {
        const perm = await Notifications.getPermissionsAsync();
        let status = perm.status;
        if (status !== 'granted') {
            const req = await Notifications.requestPermissionsAsync();
            status = req.status;
        }
        if (status !== 'granted') return;
        const { data } = await Notifications.getExpoPushTokenAsync();
        if (!data) return;
        await api.post('/auth/push-token', { token: data, platform: Platform.OS });
    } catch (err) {
        // Non-fatal. Push just won't work; app functions otherwise.
        console.warn('push register failed', err.message);
    }
}
