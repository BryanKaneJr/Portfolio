import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../api';
import SwipeCard from '../components/SwipeCard';
import { useAuth } from '../auth';

export default function SwipeScreen({ navigation }) {
    const { signOut } = useAuth();
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            // Send approximate location once on each refresh.
            const perm = await Location.requestForegroundPermissionsAsync();
            if (perm.status === 'granted') {
                const loc = await Location.getLastKnownPositionAsync();
                if (loc) {
                    await api.patch('/profile/me', {
                        lat: loc.coords.latitude,
                        lng: loc.coords.longitude,
                    });
                }
            }
            const f = await api.get('/swipe/feed');
            setFeed(f);
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const swipe = async (direction) => {
        const target = feed[0];
        if (!target) return;
        setFeed((prev) => prev.slice(1));
        try {
            const r = await api.post('/swipe/swipe', { targetId: target.id, direction });
            if (r.matched) Alert.alert("It's a match!", `You and ${target.name} liked each other.`);
        } catch (e) {
            if (e.message === 'like_limit') {
                Alert.alert('Out of likes', 'Free daily likes used up. Upgrade to premium.');
            }
        }
    };

    return (
        <View style={styles.root}>
            <View style={styles.nav}>
                <Pressable onPress={() => navigation.navigate('Matches')}><Text style={styles.link}>Matches</Text></Pressable>
                <Pressable onPress={() => navigation.navigate('Friends')}><Text style={styles.link}>Friends</Text></Pressable>
                <Pressable onPress={() => navigation.navigate('Stories')}><Text style={styles.link}>Stories</Text></Pressable>
                <Pressable onPress={() => navigation.navigate('Profile')}><Text style={styles.link}>Me</Text></Pressable>
                <Pressable onPress={signOut}><Text style={styles.link}>Sign out</Text></Pressable>
            </View>

            {feed[0] ? (
                <SwipeCard user={feed[0]} onLike={() => swipe('like')} onPass={() => swipe('pass')} />
            ) : (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No more nearby users.'}</Text>
                    <Pressable style={styles.refresh} onPress={refresh}>
                        <Text style={styles.refreshText}>Refresh</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f7f7f7' },
    nav: { flexDirection: 'row', justifyContent: 'space-around', padding: 12, backgroundColor: '#fff' },
    link: { color: '#e0245e', fontWeight: '600' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: '#666', marginBottom: 16 },
    refresh: { backgroundColor: '#e0245e', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
    refreshText: { color: '#fff', fontWeight: '600' },
});
