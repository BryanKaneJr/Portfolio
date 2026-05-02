import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { api } from '../api';
import { useAuth } from '../auth';

WebBrowser.maybeCompleteAuthSession();

const FB_AUTH = 'https://www.facebook.com/v18.0/dialog/oauth';
const IG_AUTH = 'https://api.instagram.com/oauth/authorize';

export default function LoginScreen() {
    const { signIn } = useAuth();
    const [providers, setProviders] = useState({ facebook: false, instagram: false });
    const fbAppId = Constants.expoConfig?.extra?.facebookAppId;
    const igAppId = Constants.expoConfig?.extra?.instagramAppId;

    useEffect(() => {
        api.get('/auth/providers', { auth: false })
            .then(setProviders)
            .catch(() => {});
    }, []);

    const loginFacebook = async () => {
        if (!fbAppId) return Alert.alert('Not configured', 'FACEBOOK_APP_ID missing');
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'datingapp', path: 'auth/facebook' });
        const url =
            `${FB_AUTH}?client_id=${fbAppId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code&scope=public_profile,user_friends,user_birthday`;
        const res = await WebBrowser.openAuthSessionAsync(url, redirectUri);
        if (res.type !== 'success') return;
        const code = new URL(res.url).searchParams.get('code');
        if (!code) return;
        try {
            const { token } = await api.post('/auth/facebook/callback', { code }, { auth: false });
            await signIn(token);
        } catch (e) {
            Alert.alert('Login failed', e.message);
        }
    };

    const loginInstagram = async () => {
        if (!igAppId) return Alert.alert('Not configured', 'INSTAGRAM_APP_ID missing');
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'datingapp', path: 'auth/instagram' });
        const url =
            `${IG_AUTH}?client_id=${igAppId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=user_profile&response_type=code`;
        const res = await WebBrowser.openAuthSessionAsync(url, redirectUri);
        if (res.type !== 'success') return;
        const code = new URL(res.url).searchParams.get('code');
        if (!code) return;
        try {
            const { token } = await api.post('/auth/instagram/callback', { code }, { auth: false });
            await signIn(token);
        } catch (e) {
            Alert.alert('Login failed', e.message);
        }
    };

    return (
        <View style={styles.root}>
            <Text style={styles.title}>Spark</Text>
            <Text style={styles.sub}>Sign in to continue</Text>

            <Pressable
                style={[styles.btn, styles.fb, !providers.facebook && styles.disabled]}
                disabled={!providers.facebook}
                onPress={loginFacebook}>
                <Text style={styles.btnText}>Continue with Facebook</Text>
            </Pressable>

            <Pressable
                style={[styles.btn, styles.ig, !providers.instagram && styles.disabled]}
                disabled={!providers.instagram}
                onPress={loginInstagram}>
                <Text style={styles.btnText}>Continue with Instagram</Text>
            </Pressable>

            <Text style={styles.note}>
                Facebook and Instagram are the only ways to sign in. 18+ only.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
    title: { fontSize: 48, fontWeight: '800', textAlign: 'center', color: '#e0245e' },
    sub: { textAlign: 'center', marginVertical: 24, fontSize: 16, color: '#666' },
    btn: { padding: 16, borderRadius: 12, marginVertical: 8, alignItems: 'center' },
    fb: { backgroundColor: '#1877f2' },
    ig: { backgroundColor: '#c13584' },
    disabled: { opacity: 0.4 },
    btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
    note: { textAlign: 'center', color: '#999', marginTop: 32, fontSize: 12 },
});
