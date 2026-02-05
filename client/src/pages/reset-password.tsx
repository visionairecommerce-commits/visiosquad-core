import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'wouter';
import { ArrowLeft, Loader2, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';
import visioSquadLogo from '@assets/ChatGPT_Image_Jan_29,_2026,_09_28_16_PM_1769747467171.png';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const initSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (type === 'recovery' && accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('This password reset link is invalid or has expired. Please request a new one.');
          setIsValidSession(false);
        } else {
          setIsValidSession(true);
        }
      } else {
        setError('Invalid password reset link. Please request a new one.');
        setIsValidSession(false);
      }
      
      setIsInitializing(false);
    };
    
    initSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    
    if (password.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setIsSuccess(true);
      toast({ title: 'Password updated successfully!' });
      
      setTimeout(() => {
        setLocation('/login');
      }, 3000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message || 'Failed to reset password. Please try again.');
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to reset password.',
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-6">
          <img 
            src={visioSquadLogo} 
            alt="VisioSquad - Connect. Communicate. Compete." 
            className="w-full h-auto dark:invert"
            data-testid="img-logo"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isInitializing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Validating Link
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Password Reset
                </>
              ) : !isValidSession ? (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Invalid Link
                </>
              ) : error ? (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Reset Failed
                </>
              ) : (
                'Create New Password'
              )}
            </CardTitle>
            <CardDescription>
              {isInitializing
                ? 'Please wait while we validate your reset link...'
                : isSuccess 
                ? "Your password has been updated successfully. You'll be redirected to sign in."
                : !isValidSession
                ? 'This password reset link is invalid or has expired.'
                : error
                ? 'There was a problem resetting your password.'
                : 'Enter your new password below.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInitializing ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !isValidSession ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <div className="text-sm">
                    <p className="font-medium">Link Expired or Invalid</p>
                    <p className="text-muted-foreground">Please request a new password reset link.</p>
                  </div>
                </div>
                <Link href="/forgot-password">
                  <Button className="w-full" data-testid="button-request-new-link">
                    Request New Link
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : isSuccess ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="text-sm">
                    <p className="font-medium">Success!</p>
                    <p className="text-muted-foreground">Redirecting to sign in...</p>
                  </div>
                </div>
                <Link href="/login">
                  <Button className="w-full" data-testid="button-go-to-login">
                    Sign In Now
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      data-testid="input-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    data-testid="input-confirm-password"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-reset-password"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reset Password
                </Button>

                <Link href="/login">
                  <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
