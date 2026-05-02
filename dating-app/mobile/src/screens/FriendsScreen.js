import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Image, Alert } from 'react-native';
import { api } from '../api';

// "More Than Friends" - the user's eligible friends. The `you_liked` flag is
// the user's own private state; the other side never learns about it unless
// they ALSO like back, at which point both see a 'friend' match.
export default function FriendsScreen() {
    const [friends, setFriends] = useState([]);

    const load = useCallback(() => {
        api.get('/friends/eligible').then(setFriends).catch(() => {});
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggle = async (f) => {
        try {
            if (f.you_liked) {
                await api.del(`/friends/like/${f.id}`);
            } else {
                const r = await api.post('/friends/like', { friendId: f.id });
                if (r.matched) {
                    Alert.alert('More Than Friends!', `You and ${f.name} both liked each other.`);
                }
            }
            load();
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <Text style={styles.note}>
                Likes here are private. The other person only learns if they like you back.
            </Text>
            <FlatList
                data={friends}
                keyExtractor={(f) => f.id}
                ListEmptyComponent={<Text style={styles.empty}>No eligible friends from connected accounts yet.</Text>}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        {item.photos?.[0]
                            ? <Image source={{ uri: item.photos[0] }} style={styles.avatar} />
                            : <View style={[styles.avatar, styles.avatarPlaceholder]} />}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{item.name}, {item.age}</Text>
                        </View>
                        <Pressable
                            style={[styles.btn, item.you_liked && styles.btnActive]}
                            onPress={() => toggle(item)}>
                            <Text style={[styles.btnText, item.you_liked && styles.btnActiveText]}>
                                {item.you_liked ? 'Liked' : 'Like'}
                            </Text>
                        </Pressable>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    note: { padding: 12, color: '#666', backgroundColor: '#fff7d6' },
    row: { flexDirection: 'row', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' },
    avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
    avatarPlaceholder: { backgroundColor: '#ddd' },
    name: { fontSize: 16, fontWeight: '600' },
    btn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e0245e' },
    btnActive: { backgroundColor: '#e0245e' },
    btnText: { color: '#e0245e', fontWeight: '600' },
    btnActiveText: { color: '#fff' },
    empty: { padding: 24, textAlign: 'center', color: '#888' },
});
