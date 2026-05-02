import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { api } from '../api';
import StoryItem from '../components/StoryItem';

export default function StoriesScreen() {
    const [feed, setFeed] = useState([]);
    const [caption, setCaption] = useState('');

    const load = useCallback(() => {
        api.get('/stories/feed').then(setFeed).catch(() => {});
    }, []);

    useEffect(() => { load(); }, [load]);

    const post = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const pick = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.7 });
        if (pick.canceled) return;
        const local = pick.assets[0].uri;

        // Get a presigned URL. For MVP the storage stub returns a placeholder
        // public URL; in production we'd PUT the image to uploadUrl first.
        const { publicUrl } = await api.post('/profile/upload-url', { contentType: 'image/jpeg' });

        let lat, lng;
        const locPerm = await Location.requestForegroundPermissionsAsync();
        if (locPerm.status === 'granted') {
            const loc = await Location.getLastKnownPositionAsync();
            if (loc) { lat = loc.coords.latitude; lng = loc.coords.longitude; }
        }

        try {
            await api.post('/stories', { imageUrl: publicUrl, caption, lat, lng });
            setCaption('');
            load();
        } catch (e) {
            Alert.alert('Post failed', e.message);
        }
    };

    const report = async (story) => {
        await api.post('/reports', {
            targetStoryId: story.id,
            reason: 'inappropriate',
        });
        Alert.alert('Reported', 'Thanks - our team will review.');
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.composer}>
                <TextInput
                    style={styles.input}
                    placeholder="Caption"
                    value={caption}
                    onChangeText={setCaption}
                />
                <Pressable style={styles.postBtn} onPress={post}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Post Story</Text>
                </Pressable>
            </View>
            <FlatList
                data={feed}
                keyExtractor={(s) => s.id}
                renderItem={({ item }) => <StoryItem story={item} onReport={report} />}
                ListEmptyComponent={<Text style={styles.empty}>
                    No stories visible to you yet. Like or match someone first.
                </Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    composer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
    input: { flex: 1, backgroundColor: '#f1f1f1', borderRadius: 24, paddingHorizontal: 12 },
    postBtn: { backgroundColor: '#e0245e', justifyContent: 'center', paddingHorizontal: 16, marginLeft: 8, borderRadius: 24 },
    empty: { padding: 24, textAlign: 'center', color: '#888' },
});
