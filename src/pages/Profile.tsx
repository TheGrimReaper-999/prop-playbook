import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useBetSlip } from '@/contexts/BetSlipContext';
import { useCareerStats } from '@/hooks/useCareerStats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, LogOut, User, Camera, Loader2, DollarSign, TrendingUp, CheckCircle2, XCircle, MinusCircle, Target, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '@/components/Footer';

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading, updateProfile, uploadAvatar } = useProfile();
  const { parlays } = useBetSlip();
  const { data: careerStats, isLoading: careerStatsLoading } = useCareerStats();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPnl = useMemo(() => parlays.reduce((sum, p) => sum + (p.pnl || 0), 0), [parlays]);
  const trackedCount = useMemo(
    () => parlays.filter((p) => p.pnl !== null && p.pnl !== undefined).length,
    [parlays]
  );

  // Initialize display name once profile loads (without auto-saving)
  useEffect(() => {
    if (!profile) return;
    if (isDirty) return;
    setDisplayName(profile.display_name || '');
  }, [profile, isDirty]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }

    setSaving(true);
    const { error } = await updateProfile({ display_name: displayName.trim() });
    setSaving(false);

    if (error) {
      toast.error('Failed to update profile. Please try again.');
    } else {
      toast.success('Profile updated successfully.');
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);
    const { error } = await uploadAvatar(file);
    setUploadingAvatar(false);

    if (error) {
      toast.error('Failed to upload avatar. Please try again.');
    } else {
      toast.success('Avatar updated successfully.');
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out. Please try again.');
    } else {
      navigate('/');
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="container max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8 flex-1">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4 sm:mb-6 -ml-2"
          size="sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Avatar with upload */}
              <div 
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer group overflow-hidden flex-shrink-0"
                onClick={handleAvatarClick}
              >
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              
              <div className="min-w-0">
                <CardTitle className="text-lg sm:text-xl">Profile</CardTitle>
                <CardDescription className="truncate text-sm">{user.email}</CardDescription>
                <p className="text-xs text-muted-foreground mt-0.5">Click avatar to change</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
            <Card className={`border-2 ${totalPnl > 0 ? 'border-green-500/50 bg-green-500/10' : totalPnl < 0 ? 'border-red-500/50 bg-red-500/10' : 'border-border/50 bg-card/50'}`}>
              <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    totalPnl > 0 ? 'bg-green-500/20' : totalPnl < 0 ? 'bg-red-500/20' : 'bg-muted'
                  }`}>
                    <DollarSign className={`w-4 h-4 sm:w-5 sm:h-5 ${
                      totalPnl > 0 ? 'text-green-500' : totalPnl < 0 ? 'text-red-500' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Total P&L</p>
                    <p className="text-xs text-muted-foreground truncate">{trackedCount}/{parlays.length} tracked</p>
                  </div>
                </div>
                <span className={`text-xl sm:text-2xl font-black flex-shrink-0 ${totalPnl > 0 ? 'text-green-500' : totalPnl < 0 ? 'text-red-500' : 'text-foreground'}`}>
                  {totalPnl > 0 ? '+' : ''}{totalPnl.toFixed(2)}
                </span>
              </CardContent>
            </Card>

            {/* Career Stats */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  <CardTitle className="text-base sm:text-lg">Career Stats</CardTitle>
                </div>
                <CardDescription className="text-xs sm:text-sm">Your prediction performance</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 p-3 sm:p-6">
                {careerStatsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : careerStats ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-background/50 rounded-lg p-2 sm:p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Taken</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold">{careerStats.legsTaken}</p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-2 sm:p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                        <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                        <span className="text-xs text-muted-foreground">Wins</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-green-500">{careerStats.legsWon}</p>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-2 sm:p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                        <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                        <span className="text-xs text-muted-foreground">Losses</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-red-500">{careerStats.legsLost}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 sm:p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                        <MinusCircle className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Skipped</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold">{careerStats.noBets}</p>
                    </div>
                  </div>
                ) : null}
                {careerStats && careerStats.legsTaken > 0 && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Win Rate</span>
                    <span className={`text-base sm:text-lg font-bold ${careerStats.winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                      {careerStats.winRate.toFixed(1)}%
                    </span>
                  </div>
                )}
                {careerStats && (
                  <Button 
                    variant="outline" 
                    className="w-full mt-2 sm:mt-3"
                    size="sm"
                    onClick={() => navigate('/leaderboard')}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    View Leaderboard
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setIsDirty(true);
                  setDisplayName(e.target.value);
                }}
                placeholder="Enter your display name"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                This name will be shown across the app
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Email</Label>
              <Input value={user.email || ''} disabled className="bg-muted text-sm" />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button onClick={handleSave} disabled={saving} className="flex-1" size="sm">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={handleSignOut} className="flex-1" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </main>
  );
};

export default Profile;
