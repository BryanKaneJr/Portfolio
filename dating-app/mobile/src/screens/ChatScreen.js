import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, FlatList, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, API_URL } from '../api';

// React Native has fetch streaming, but no built-in EventSource. Rather than
// pulling a polyfill, we parse the SSE wire format from the streamed response.
// Falls back to polling if streaming isn't supported (older RN releases).
async function openStream(matchId, onMessage, onError) {
    const token = await AsyncStorage.getItem('token');
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
        try {
            const res = await fetch(`${API_URL}/chat/${matchId}/stream`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
                signal: controller.signal,
            });
            if (!res.ok || !res.body || !res.body.getReader) {
                throw new Error('sse_unsupported');
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buf = '';
            while (!cancelled) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buf.indexOf('\n\n')) !== -1) {
                    const event = buf.slice(0, idx);
                    buf = buf.slice(idx + 2);
                    for (const line of event.split('\n')) {
                        if (line.startsWith('data:')) {
                            try {
                                const payload = JSON.parse(line.slice(5).trim());
                                onMessage(payload);
                            } catch { /* ignore parse errors */ }
                        }
                    }
                }
            }
        } catch (err) {
            if (!cancelled) onError(err);
        }
    })();

    return () => { cancelled = true; controller.abort(); };
}

export default function ChatScreen({ route, navigation }) {
    const { matchId, name } = route.params;
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const listRef = useRef(null);

    const unmatch = useCallback(async () => {
        await api.post(`/matches/${matchId}/unmatch`);
        navigation.goBack();
    }, [matchId, navigation]);

    useEffect(() => navigation.setOptions({
        title: name || 'Chat',
        headerRight: () => (
            <Pressable onPress={unmatch}><Text style={{ color: '#e0245e' }}>Unmatch</Text></Pressable>
        ),
    }), [name, unmatch, navigation]);

    const load = useCallback(async () => {
        try {
            const m = await api.get(`/chat/${matchId}/messages`);
            setMessages(m);
        } catch {}
    }, [matchId]);

    // Initial history load + live stream. Polling only kicks in if SSE fails.
    useEffect(() => {
        let pollTimer = null;
        let closeStream = () => {};
        let mounted = true;

        (async () => {
            await load();
            closeStream = await openStream(
                matchId,
                (msg) => {
                    if (!mounted) return;
                    setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
                },
                () => {
                    // SSE failed; fall back to polling
                    if (!mounted || pollTimer) return;
                    pollTimer = setInterval(load, 4000);
                }
            );
        })();

        return () => {
            mounted = false;
            closeStream();
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [matchId, load]);

    const send = async () => {
        const body = draft.trim();
        if (!body) return;
        setDraft('');
        try {
            const msg = await api.post(`/chat/${matchId}/messages`, { body });
            setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        } catch (e) {
            Alert.alert('Send failed', e.message);
        }
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
