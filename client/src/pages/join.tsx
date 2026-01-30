import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import visioSquadLogo from '@assets/ChatGPT_Image_Jan_29,_2026,_09_10_32_PM_1769746263904.png';

type JoinStep = 'code' | 'details' | 'signature';

interface ClubInfo {
  club_id: string;
  club_name: string;
  has_waiver: boolean;
  has_contract: boolean;
}

export default function JoinPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialCode = urlParams.get('code') || '';
  
  const [step, setStep] = useState<JoinStep>(initialCode ? 'details' : 'code');
  const [joinCode, setJoinCode] = useState(initialCode.toUpperCase());
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'coach' | 'parent'>('parent');
  const [showPassword, setShowPassword] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [agreedToWaiver, setAgreedToWaiver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [waiverContent, setWaiverContent] = useState('');
  
  const { registerUser, signDocument } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const validateCode = async () => {
    if (joinCode.length !== 6) {
      toast({ title: 'Please enter a 6-character club code', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/auth/validate-code', { join_code: joinCode });
      const data = await response.json();
      
      if (!response.ok) {
        toast({ title: data.error || 'Invalid club code', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      
      setClubInfo({
        club_id: data.club_id,
        club_name: data.club_name,
        has_waiver: data.has_waiver,
        has_contract: data.has_contract,
      });
      
      const clubResponse = await apiRequest('GET', `/api/clubs/${data.club_id}`);
      const clubData = await clubResponse.json();
      if (clubData.waiver_content) {
        setWaiverContent(clubData.waiver_content);
      }
      
      setStep('details');
    } catch (error) {
      toast({ title: 'Failed to validate code', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    
    if (password.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const result = await registerUser(joinCode, fullName, email, password, role);
    setIsLoading(false);
    
    if (result.success) {
      if (result.needsSignature && clubInfo?.has_waiver) {
        setStep('signature');
      } else {
        toast({ title: 'Account created successfully!' });
        setLocation('/');
      }
    } else {
      toast({ title: result.error || 'Registration failed', variant: 'destructive' });
    }
  };

  const handleSign = async () => {
    if (!signedName) {
      toast({ title: 'Please type your full legal name', variant: 'destructive' });
      return;
    }
    
    if (!agreedToWaiver) {
      toast({ title: 'You must agree to the waiver', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const result = await signDocument('waiver', signedName);
    setIsLoading(false);
    
    if (result.success) {
      toast({ title: 'Documents signed successfully!' });
      setLocation('/');
    } else {
      toast({ title: 'Failed to sign documents', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4 mb-2">
          <div className="flex items-center justify-center">
            <img 
              src={visioSquadLogo} 
              alt="VisioSquad - Connect. Communicate. Compete." 
              className="h-16 w-auto dark:invert"
              data-testid="img-logo"
            />
          </div>
        </div>

        {step === 'code' && (
          <Card>
            <CardHeader>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit -ml-2"
                onClick={() => setLocation('/login')}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <CardTitle>Join a Club</CardTitle>
              <CardDescription>
                Enter the 6-character code from your club director
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">Club Code</Label>
                <Input
                  id="joinCode"
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  className="text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                  data-testid="input-join-code"
                />
              </div>

              <Button
                className="w-full"
                onClick={validateCode}
                disabled={isLoading || joinCode.length !== 6}
                data-testid="button-validate-code"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'details' && clubInfo && (
          <Card>
            <CardHeader>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit -ml-2"
                onClick={() => setStep('code')}
                data-testid="button-back-to-code"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <CardTitle>Join {clubInfo.club_name}</CardTitle>
              <CardDescription>
                Create your account to join this club
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Joining: {clubInfo.club_name}</span>
              </div>
              
              <div className="space-y-2">
                <Label>I am a...</Label>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as 'coach' | 'parent')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="parent" id="parent" data-testid="radio-parent" />
                    <Label htmlFor="parent" className="cursor-pointer">Parent</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="coach" id="coach" data-testid="radio-coach" />
                    <Label htmlFor="coach" className="cursor-pointer">Coach</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  data-testid="input-full-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
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
                    placeholder="At least 8 characters"
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
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleRegister}
                disabled={isLoading}
                data-testid="button-register"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {clubInfo.has_waiver ? 'Continue to Sign Waiver' : 'Create Account'}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'signature' && clubInfo && (
          <Card>
            <CardHeader>
              <CardTitle>Sign Club Waiver</CardTitle>
              <CardDescription>
                Please review and sign the waiver for {clubInfo.club_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-48 overflow-y-auto p-4 bg-muted/50 rounded-lg text-sm">
                {waiverContent || 'Loading waiver content...'}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="agreeWaiver"
                    checked={agreedToWaiver}
                    onChange={(e) => setAgreedToWaiver(e.target.checked)}
                    className="mt-1"
                    data-testid="checkbox-agree"
                  />
                  <Label htmlFor="agreeWaiver" className="text-sm cursor-pointer">
                    I have read and agree to the terms of this waiver
                  </Label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signedName">Type your full legal name to sign</Label>
                <Input
                  id="signedName"
                  placeholder="Your Legal Name"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  className="font-serif italic"
                  data-testid="input-signed-name"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSign}
                disabled={isLoading || !agreedToWaiver || !signedName}
                data-testid="button-sign"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sign and Complete Registration
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
