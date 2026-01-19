import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Use maybeSingle to handle case where profile doesn't exist
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
      return;
    }

    // If no profile exists, create one
    if (!data) {
      const defaultName = user.email?.split('@')[0] || 'User';
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          display_name: defaultName,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
      } else {
        setProfile(newProfile);
      }
    } else {
      setProfile(data);
    }
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string }) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }

    return { error };
  };

  const uploadAvatar = async (file: File): Promise<{ url: string | null; error: Error | null }> => {
    if (!user) return { url: null, error: new Error('Not authenticated') };

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      return { url: null, error: uploadError };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Add cache-busting query param
    const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

    // Update profile with new avatar URL
    const { error: updateError } = await updateProfile({ avatar_url: urlWithCacheBust });

    if (updateError) {
      return { url: null, error: updateError };
    }

    return { url: urlWithCacheBust, error: null };
  };

  return {
    profile,
    loading,
    updateProfile,
    uploadAvatar,
    refetch: fetchProfile,
  };
}
