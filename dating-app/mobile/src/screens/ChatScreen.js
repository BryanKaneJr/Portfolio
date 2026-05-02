import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, FlatList, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { api } from '../api';

export default function ChatScreen({ route, navigation }) {
    const { matchId, name } = route.params;
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const listRef = useRef(null);

    useEffect(() => navigation.setOptions({ title: name || 'Chat',
        headerRight: () => (
            <Pressable onPress={unmatch}><Text style={{ color: '#e0245e' }}>Unmatch</Text></Pressable>
        ),
    }), [name]);

    const load = useCallback(async () => {
        try {
            const m = await api.get(`/chat/${matchId}/messages`);
            setMessages(m);
        } catch {}
    }, [matchId]);

    useEffect(() => {
        load();
        const t = setInterval(load, 4000); // simple polling for MVP
        return () => clearInterval(t);
    }, [load]);

    const send = async () => {
        const body = draft.trim();
        if (!body) return;
        setDraft('');
        try {
            const msg = await api.post(`/chat/${matchId}/messages`, { body });
            setMessages((p) => [...p, msg]);
        } catch (e) {
            Alert.alert('Send failed', e.message);
        }
    };

    const unmatch = async () => {
        await api.post(`/matches/${matchId}/unmatch`);
        navigation.goBack();
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}>
            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(m) => m.id}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => (
                    <View style={styles.bubble}><Text>{item.body}</Text></View>
                )}
            />
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Message"
                />
                <Pressable style={styles.send} onPress={send}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Send</Text>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    bubble: { backgroundColor: '#eef', margin: 8, padding: 12, borderRadius: 12, alignSelf: 'flex-start', maxWidth: '80%' },
    inputRow: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#eee' },
    input: { flex: 1, padding: 12, backgroundColor: '#f1f1f1', borderRadius: 24 },
    send: { backgroundColor: '#e0245e', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 24, marginLeft: 8 },
});
