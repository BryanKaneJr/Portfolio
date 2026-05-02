import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Image } from 'react-native';
import { api } from '../api';
import { useFocusEffect } from '@react-navigation/native';

export default function MatchesScreen({ navigation }) {
    const [matches, setMatches] = useState([]);

    const load = useCallback(() => {
        api.get('/matches').then(setMatches).catch(() => {});
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    return (
        <FlatList
            data={matches}
            keyExtractor={(m) => m.id}
            ListEmptyComponent={<Text style={styles.empty}>No matches yet.</Text>}
            renderItem={({ item }) => (
                <Pressable
                    style={styles.row}
                    onPress={() => navigation.navigate('Chat', { matchId: item.id, name: item.other_name })}>
                    {item.other_photos?.[0]
                        ? <Image source={{ uri: item.other_photos[0] }} style={styles.avatar} />
                        : <View style={[styles.avatar, styles.avatarPlaceholder]} />}
                    <View>
                        <Text style={styles.name}>{item.other_name}</Text>
                        <Text style={styles.kind}>{item.kind === 'friend' ? 'More Than Friends' : 'Match'}</Text>
                    </View>
                </Pressable>
            )}
        />
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', padding: 16, alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' },
    avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
    avatarPlaceholder: { backgroundColor: '#ddd' },
    name: { fontSize: 16, fontWeight: '600' },
    kind: { color: '#888', fontSize: 12 },
    empty: { padding: 24, textAlign: 'center', color: '#888' },
});
