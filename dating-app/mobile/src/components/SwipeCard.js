import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';

export default function SwipeCard({ user, onLike, onPass }) {
    const photo = user.photos && user.photos[0];
    return (
        <View style={styles.card}>
            {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
                <View style={[styles.photo, styles.placeholder]}>
                    <Text style={{ color: '#999' }}>No photo</Text>
                </View>
            )}
            <View style={styles.info}>
                <Text style={styles.name}>{user.name}, {user.age}</Text>
                {user.distance_bucket && (
                    <Text style={styles.distance}>{user.distance_bucket} away</Text>
                )}
                {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
            </View>
            <View style={styles.actions}>
                <Pressable style={[styles.action, styles.pass]} onPress={onPass}>
                    <Text style={styles.actionText}>Pass</Text>
                </Pressable>
                <Pressable style={[styles.action, styles.like]} onPress={onLike}>
                    <Text style={styles.actionText}>Like</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 4, margin: 16 },
    photo: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#eee' },
    placeholder: { alignItems: 'center', justifyContent: 'center' },
    info: { padding: 16 },
    name: { fontSize: 22, fontWeight: '700' },
    distance: { color: '#888', marginTop: 4 },
    bio: { marginTop: 8, color: '#444' },
    actions: { flexDirection: 'row', justifyContent: 'space-around', padding: 16 },
    action: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 100 },
    pass: { backgroundColor: '#bbb' },
    like: { backgroundColor: '#e0245e' },
    actionText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
