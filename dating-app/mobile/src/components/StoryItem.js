import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';

export default function StoryItem({ story, onReport }) {
    return (
        <View style={styles.card}>
            <Image source={{ uri: story.image_url }} style={styles.img} />
            <View style={styles.meta}>
                <Text style={styles.name}>{story.poster.name}</Text>
                {story.distance_bucket && <Text style={styles.distance}>{story.distance_bucket} away</Text>}
            </View>
            {story.caption ? <Text style={styles.caption}>{story.caption}</Text> : null}
            <Pressable onPress={() => onReport(story)}><Text style={styles.report}>Report</Text></Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', margin: 12, borderRadius: 12, overflow: 'hidden' },
    img: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
    meta: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
    name: { fontWeight: '700' },
    distance: { color: '#888' },
    caption: { paddingHorizontal: 12, paddingBottom: 12 },
    report: { color: '#c00', textAlign: 'right', padding: 12 },
});
