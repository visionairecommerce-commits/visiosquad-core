import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Users, Loader2, Eye, EyeOff } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import visioSquadLogo from '@assets/ChatGPT_Image_Jan_29,_2026,_09_28_16_PM_1769747467171.png';

type AuthMode = 'signin' | 'create-account';
type AccountType = 'director' | 'member' | null;

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSignIn = async () => {
    if (!email || !password) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);
    
    if (result.success) {
      if (result.needsOnboarding) {
        setLocation('/onboarding');
      } else {
        setLocation('/');
      }
    } else {
      toast({ title: result.error || 'Login failed', variant: 'destructive' });
    }
  };

  const handleCreateAccountSelection = (type: AccountType) => {
    setAccountType(type);
    if (type === 'director') {
      setLocation('/create-club');
    } else if (type === 'member') {
      setLocation('/join');
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

        {mode === 'signin' && (
          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSignIn}
                disabled={isLoading}
                data-testid="button-signin"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>

              <div className="flex justify-between items-center">
                <Link href="/forgot-password">
                  <Button
                    variant="link"
                    className="px-0 text-muted-foreground"
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => setMode('create-account')}
                  data-testid="link-create-account"
                >
                  Create account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === 'create-account' && (
          <Card>
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>
                Choose how you want to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-auto py-4 justify-start gap-4"
                onClick={() => handleCreateAccountSelection('director')}
                data-testid="button-director-signup"
              >
                <Building2 className="h-8 w-8 shrink-0 text-primary" />
                <div className="text-left">
                  <div className="font-semibold">I am a Club Director</div>
                  <div className="text-sm text-muted-foreground">
                    Create a new club and invite members
                  </div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-auto py-4 justify-start gap-4"
                onClick={() => handleCreateAccountSelection('member')}
                data-testid="button-member-signup"
              >
                <Users className="h-8 w-8 shrink-0 text-primary" />
                <div className="text-left">
                  <div className="font-semibold">I am a Parent / Coach</div>
                  <div className="text-sm text-muted-foreground">
                    Join an existing club with a club code
                  </div>
                </div>
              </Button>

              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => setMode('signin')}
                  data-testid="link-signin"
                >
                  Already have an account? Sign in
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our{' '}
          <Link href="/terms-of-service" className="underline hover:text-foreground" data-testid="link-terms-of-service">
            Terms of Service
          </Link>
          {' '}and Privacy Policy
        </p>
      </div>
    </div>
  );
}
