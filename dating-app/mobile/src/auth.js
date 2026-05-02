import { createContext, useContext } from 'react';

export const AuthContext = createContext({ token: null, signIn: () => {}, signOut: () => {} });
export const useAuth = () => useContext(AuthContext);
