import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';

export default function ProfileScreen({ navigation }) {
    const [me, setMe] = useState(null);

    const load = useCallback(() => {
        api.get('/profile/me').then(setMe).catch(() => {});
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const togglePremium = async () => {
        try {
            const r = await api.post('/billing/dev/set-premium', { premium: !me.is_premium }, {
                headers: { 'x-debug-billing': '1' },
            });
            Alert.alert('Premium', r.premium ? 'Enabled (dev)' : 'Disabled (dev)');
            load();
        } catch (e) { Alert.alert('Error', e.message); }
    };

    if (!me) return null;
    return (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
            {me.photos?.[0] && <Image source={{ uri: me.photos[0] }} style={styles.avatar} />}
            <Text style={styles.name}>{me.name}, {me.age}</Text>
            <Text style={styles.bio}>{me.bio || '— No bio —'}</Text>

            <Pressable style={styles.btn} onPress={() => navigation.navigate('EditProfile')}>
                <Text style={styles.btnText}>Edit Profile</Text>
            </Pressable>

            <View style={styles.section}>
                <Text style={styles.h2}>Premium</Text>
                <Text style={{ color: '#666' }}>
                    {me.is_premium
                        ? 'Active: see who liked you, unlimited likes, boost.'
                        : 'Free tier: 50 likes / day. Upgrade to unlock premium features.'}
                </Text>
                <Pressable style={styles.btn} onPress={togglePremium}>
                    <Text style={styles.btnText}>{me.is_premium ? 'Disable (dev)' : 'Enable (dev)'}</Text>
                </Pressable>
            </View>

            <View style={styles.section}>
                <Text style={styles.h2}>Discoverable: {me.discoverable ? 'Yes' : 'No'}</Text>
                <Text style={styles.h2}>Friend opt-out: {me.friend_optout ? 'Yes' : 'No'}</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    avatar: { width: 160, height: 160, borderRadius: 80, alignSelf: 'center', backgroundColor: '#eee' },
    name: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginTop: 12 },
    bio: { textAlign: 'center', color: '#666', marginVertical: 8 },
    section: { marginTop: 24 },
    h2: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    btn: { backgroundColor: '#e0245e', padding: 14, borderRadius: 24, alignItems: 'center', marginTop: 12 },
    btnText: { color: '#fff', fontWeight: '600' },
});
