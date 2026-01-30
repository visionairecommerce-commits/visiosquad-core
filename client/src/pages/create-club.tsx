import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import visioSquadLogo from '@assets/ChatGPT_Image_Jan_29,_2026,_09_28_16_PM_1769747467171.png';

export default function CreateClubPage() {
  const [clubName, setClubName] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { createClub } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleCreateClub = async () => {
    if (!clubName || !directorName || !email || !password) {
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
    const result = await createClub(clubName, directorName, email, password);
    setIsLoading(false);
    
    if (result.success) {
      toast({ title: 'Club created successfully!' });
      setLocation('/onboarding');
    } else {
      toast({ title: result.error || 'Failed to create club', variant: 'destructive' });
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
            <CardTitle>Create Your Club</CardTitle>
            <CardDescription>
              Set up your sports organization on VisioSquad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clubName">Club Name</Label>
              <Input
                id="clubName"
                placeholder="Elite Sports Academy"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                data-testid="input-club-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="directorName">Your Name</Label>
              <Input
                id="directorName"
                placeholder="John Smith"
                value={directorName}
                onChange={(e) => setDirectorName(e.target.value)}
                data-testid="input-director-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@club.com"
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
              onClick={handleCreateClub}
              disabled={isLoading}
              data-testid="button-create-club"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Club
            </Button>

            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>After creating your club, you'll set up your waiver and contract documents</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>You'll receive a unique club code to share with parents and coaches</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
