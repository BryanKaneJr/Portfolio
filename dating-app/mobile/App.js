import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import SwipeScreen from './src/screens/SwipeScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import ChatScreen from './src/screens/ChatScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import StoriesScreen from './src/screens/StoriesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import { AuthContext } from './src/auth';
import { registerPushToken } from './src/push';
import { api } from './src/api';

const Stack = createNativeStackNavigator();

export default function App() {
    const [token, setToken] = useState(null);
    // 'checking' -> we know there's a token but need to see if profile is complete.
    // 'complete' or 'onboarding' after that check.
    const [profileState, setProfileState] = useState('checking');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('token').then((t) => {
            setToken(t);
            setReady(true);
        });
    }, []);

    // Whenever the token changes, decide whether the user needs onboarding.
    // A profile counts as complete when it has at least one photo and a name.
    // This is the same rule the UI needs to nudge Instagram signups (which
    // arrive without any photos) into completing their profile.
    useEffect(() => {
        if (!token) { setProfileState('checking'); return; }
        (async () => {
            try {
                const me = await api.get('/profile/me');
                const complete = me?.name && me?.photos && me.photos.length > 0;
                setProfileState(complete ? 'complete' : 'onboarding');
                registerPushToken(); // fire-and-forget
            } catch {
                setProfileState('complete'); // don't lock out user on a transient error
            }
        })();
    }, [token]);

    const signIn = async (t) => {
        await AsyncStorage.setItem('token', t);
        setToken(t);
    };
    const signOut = async () => {
        await AsyncStorage.removeItem('token');
        setToken(null);
    };

    if (!ready) return null;

    return (
        <AuthContext.Provider value={{ token, signIn, signOut }}>
            <NavigationContainer>
                <Stack.Navigator>
                    {!token ? (
                        <Stack.Screen name="Login" component={LoginScreen}
                            options={{ headerShown: false }} />
                    ) : profileState === 'onboarding' ? (
                        <Stack.Screen name="EditProfile" component={EditProfileScreen}
                            initialParams={{ onboarding: true }}
                            options={{ title: 'Complete Your Profile', headerLeft: () => null }} />
                    ) : (
                        <>
                            <Stack.Screen name="Swipe" component={SwipeScreen} />
                            <Stack.Screen name="Matches" component={MatchesScreen} />
                            <Stack.Screen name="Chat" component={ChatScreen} />
                            <Stack.Screen name="Friends" component={FriendsScreen}
                                options={{ title: 'More Than Friends' }} />
                            <Stack.Screen name="Stories" component={StoriesScreen} />
                            <Stack.Screen name="Profile" component={ProfileScreen} />
                            <Stack.Screen name="EditProfile" component={EditProfileScreen}
                                options={{ title: 'Edit Profile' }} />
                        </>
                    )}
                </Stack.Navigator>
            </NavigationContainer>
        </AuthContext.Provider>
    );
}
