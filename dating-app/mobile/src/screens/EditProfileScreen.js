import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, Switch, ScrollView, Pressable, StyleSheet, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, uploadFile, absUrl } from '../api';

const MAX_PHOTOS = 6;

export default function EditProfileScreen({ navigation, route }) {
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const onboarding = route?.params?.onboarding;

    useEffect(() => {
        api.get('/profile/me').then((m) => setForm({
            name: m.name || '',
            age: String(m.age || 18),
            gender: m.gender || '',
            bio: m.bio || '',
            photos: m.photos || [],
            preferences: m.preferences || { gender: '', min_age: 18, max_age: 99, max_km: 50 },
            discoverable: m.discoverable,
            friend_optout: m.friend_optout,
        }));
    }, []);

    if (!form) return null;
    const setField = (k, v) => setForm({ ...form, [k]: v });
    const setPref = (k, v) => setForm({ ...form, preferences: { ...form.preferences, [k]: v } });

    const addPhoto = async () => {
        if (form.photos.length >= MAX_PHOTOS) return;
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const pick = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true, aspect: [3, 4], quality: 0.7,
        });
        if (pick.canceled) return;
        setBusy(true);
        try {
            const presign = await api.post('/profile/upload-url', { contentType: 'image/jpeg' });
            const publicUrl = await uploadFile(pick.assets[0].uri, presign);
            setForm({ ...form, photos: [...form.photos, publicUrl] });
        } catch (e) {
            Alert.alert('Upload failed', e.message);
        } finally {
            setBusy(false);
        }
    };

    const removePhoto = (idx) => {
        setForm({ ...form, photos: form.photos.filter((_, i) => i !== idx) });
    };

    const save = async () => {
        const age = parseInt(form.age, 10);
        if (Number.isNaN(age) || age < 18) return Alert.alert('Age', 'Must be 18+.');
        if (!form.name.trim()) return Alert.alert('Name', 'Name is required.');
        try {
            await api.patch('/profile/me', {
                name: form.name.trim(),
                age,
                gender: form.gender || null,
                bio: form.bio,
                photos: form.photos,
                preferences: form.preferences,
                discoverable: form.discoverable,
                friend_optout: form.friend_optout,
            });
            if (onboarding) {
                navigation.reset({ index: 0, routes: [{ name: 'Swipe' }] });
            } else {
                navigation.goBack();
            }
        } catch (e) {
            Alert.alert('Save failed', e.message);
        }
    };

    return (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
            {onboarding && (
                <Text style={styles.onboarding}>
                    Welcome. Add a photo, confirm your age, and tell us a bit about you.
                </Text>
            )}

            <Text style={styles.h2}>Photos</Text>
            <View style={styles.photoRow}>
                {form.photos.map((uri, idx) => (
                    <Pressable key={idx} onLongPress={() => removePhoto(idx)}>
                        <Image source={{ uri: absUrl(uri) }} style={styles.photo} />
                    </Pressable>
                ))}
                {form.photos.length < MAX_PHOTOS && (
                    <Pressable style={[styles.photo, styles.photoAdd]} onPress={addPhoto} disabled={busy}>
                        <Text style={styles.photoAddText}>{busy ? '…' : '+'}</Text>
                    </Pressable>
                )}
            </View>
            <Text style={styles.hint}>Long-press a photo to remove.</Text>

            <Field label="Name"><TextInput style={styles.input} value={form.name} onChangeText={(v) => setField('name', v)} /></Field>
            <Field label="Age"><TextInput style={styles.input} keyboardType="numeric" value={form.age} onChangeText={(v) => setField('age', v)} /></Field>
            <Field label="Gender"><TextInput style={styles.input} value={form.gender} onChangeText={(v) => setField('gender', v)} /></Field>
            <Field label="Bio"><TextInput style={[styles.input, { height: 100 }]} multiline value={form.bio} onChangeText={(v) => setField('bio', v)} /></Field>

            <Text style={styles.h2}>Preferences</Text>
            <Field label="Interested in (gender)"><TextInput style={styles.input} value={form.preferences.gender || ''} onChangeText={(v) => setPref('gender', v)} /></Field>
            <Field label="Min age"><TextInput style={styles.input} keyboardType="numeric" value={String(form.preferences.min_age)} onChangeText={(v) => setPref('min_age', parseInt(v) || 18)} /></Field>
            <Field label="Max age"><TextInput style={styles.input} keyboardType="numeric" value={String(form.preferences.max_age)} onChangeText={(v) => setPref('max_age', parseInt(v) || 99)} /></Field>
            <Field label="Max distance (km)"><TextInput style={styles.input} keyboardType="numeric" value={String(form.preferences.max_km)} onChangeText={(v) => setPref('max_km', parseInt(v) || 50)} /></Field>

            <View style={styles.row}>
                <Text>Discoverable</Text>
                <Switch value={form.discoverable} onValueChange={(v) => setField('discoverable', v)} />
            </View>
            <View style={styles.row}>
                <Text>Hide from friends ("More Than Friends" opt-out)</Text>
                <Switch value={form.friend_optout} onValueChange={(v) => setField('friend_optout', v)} />
            </View>

            <Pressable style={styles.btn} onPress={save}><Text style={styles.btnText}>Save</Text></Pressable>
        </ScrollView>
    );
}

const Field = ({ label, children }) => (
    <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>{label}</Text>
        {children}
    </View>
);

const styles = StyleSheet.create({
    label: { color: '#666', marginBottom: 4 },
    input: { backgroundColor: '#f1f1f1', borderRadius: 8, padding: 10 },
    h2: { fontSize: 16, fontWeight: '700', marginVertical: 12 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
    btn: { backgroundColor: '#e0245e', padding: 14, borderRadius: 24, alignItems: 'center', marginTop: 24 },
    btnText: { color: '#fff', fontWeight: '600' },
    onboarding: { backgroundColor: '#fff7d6', padding: 12, borderRadius: 8, marginBottom: 12, color: '#665500' },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photo: { width: 96, height: 128, borderRadius: 8, backgroundColor: '#eee' },
    photoAdd: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ccc', borderStyle: 'dashed' },
    photoAddText: { fontSize: 32, color: '#999' },
    hint: { color: '#999', fontSize: 12, marginTop: 4 },
});
