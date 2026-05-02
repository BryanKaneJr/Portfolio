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

const Stack = createNativeStackNavigator();

export default function App() {
    const [token, setToken] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('token').then((t) => {
            setToken(t);
            setReady(true);
        });
    }, []);

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
                    {token ? (
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
                    ) : (
                        <Stack.Screen name="Login" component={LoginScreen}
                            options={{ headerShown: false }} />
                    )}
                </Stack.Navigator>
            </NavigationContainer>
        </AuthContext.Provider>
    );
}
