'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@/lib/auth';

interface AuthContextType {
    session: Session | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    loading: true,
});

export function AuthProvider({
    children,
    initialSession
}: {
    children: React.ReactNode;
    initialSession: Session | null;
}) {
    const [session, setSession] = useState<Session | null>(initialSession);
    const [loading, setLoading] = useState(!initialSession);

    useEffect(() => {
        if (!initialSession) {
            fetchSession();
        }
    }, [initialSession]);

    const fetchSession = async () => {
        try {
            const res = await fetch('/api/auth/session'); // I might need to create this endpoint
            if (res.ok) {
                const data = await res.json();
                setSession(data.session);
            }
        } catch (error) {
            console.error('Failed to fetch session:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ session, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
