'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { UserProfile, UserLevelData } from '@/types';
import { App } from '@capacitor/app';

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    levelData: UserLevelData | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
    updateLevelData: (updates: Partial<UserLevelData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    levelData: null,
    loading: true,
    signOut: async () => { },
    refreshProfile: async () => { },
    updateProfile: async () => { },
    updateLevelData: async () => { },
});

export const useAuth = () => useContext(AuthContext);

// Default guest profile
const guestProfile: UserProfile = {
    id: 'guest',
    username: 'Guest',
    level: 1,
    xp: 0,
    next_level_xp: 100,
    theme: 'student',
    goal: 'Try the app!',
    placement_test_done: true,
    learning_target: 'English',
    study_guide_langs: ['Japanese']
};

const guestLevelData: UserLevelData = {
    user_id: 'guest',
    subject: 'English',
    level_result: 'A1 (Beginner)',
    score: 0,
    xp: 0
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [levelData, setLevelData] = useState<UserLevelData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();

            if (profileData) {
                setProfile(profileData as UserProfile);

                // Fetch level data for the current target (defaulting to English if not set, or use profile's target)
                const target = profileData.learning_target || 'English';
                const { data: lData } = await supabase
                    .from('user_levels')
                    .select('*')
                    .match({ user_id: userId, subject: target })
                    .single();

                if (lData) {
                    setLevelData(lData as UserLevelData);
                } else {
                    // Create initial level data if missing
                    const initialLevel = { user_id: userId, subject: target, level_result: 'A1 (Beginner)', score: 0, xp: 0 };
                    await supabase.from('user_levels').insert(initialLevel);
                    setLevelData(initialLevel as UserLevelData);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };



    // ... existing imports

    useEffect(() => {
        let mounted = true;

        // Listen for deep links (Mobile Auth Callback)
        App.addListener('appUrlOpen', async (data) => {
            if (!mounted) return;
            // Supabase handles the URL if it contains access_token
            // We just need to ensure the session is refreshed
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUser(session.user);
                await fetchProfile(session.user.id);
            }
        });

        // Initial session check
        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.error("Auth session error:", error);
                    if (error.message.includes("Refresh Token")) {
                        console.warn("Invalid refresh token, signing out...");
                        await supabase.auth.signOut();
                        if (mounted) {
                            setUser(null);
                            setProfile(guestProfile);
                            setLevelData(guestLevelData);
                        }
                    }
                }
            } catch (e) {
                console.error("Unexpected auth error:", e);
            }
        };
        initAuth();

        // Safety timeout: If auth check doesn't complete in 5 seconds, fallback to guest
        const safetyTimeout = setTimeout(() => {
            if (mounted) {
                console.warn('AuthProvider: Auth check timed out, falling back to guest');
                setLoading(false);
            }
        }, 5000);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            clearTimeout(safetyTimeout); // Clear timeout when auth responds

            console.log(`Auth state changed: ${event}`);

            if (session) {
                setUser(session.user);
                try {
                    await fetchProfile(session.user.id);
                } catch (e) {
                    console.error('Error fetching profile in auth listener', e);
                }
            } else {
                setUser(null);
                setProfile(guestProfile);
                setLevelData(guestLevelData);
            }

            setLoading(false);
        });

        return () => {
            mounted = false;
            clearTimeout(safetyTimeout);
            subscription.unsubscribe();
            App.removeAllListeners();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(guestProfile);
        setLevelData(guestLevelData);
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    const updateProfile = async (updates: Partial<UserProfile>) => {
        if (!user) {
            // Update local state for guest
            setProfile(prev => prev ? { ...prev, ...updates } : null);
            return;
        }

        try {
            const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
            if (error) throw error;
            setProfile(prev => prev ? { ...prev, ...updates } : null);
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    };

    const updateLevelData = async (updates: Partial<UserLevelData>) => {
        if (!user || !profile) return;

        try {
            const { error } = await supabase
                .from('user_levels')
                .update(updates)
                .match({ user_id: user.id, subject: profile.learning_target });

            if (error) throw error;
            setLevelData(prev => prev ? { ...prev, ...updates } : null);
        } catch (error) {
            console.error('Error updating level data:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            levelData,
            loading,
            signOut,
            refreshProfile,
            updateProfile,
            updateLevelData
        }}>
            {children}
        </AuthContext.Provider>
    );
};
