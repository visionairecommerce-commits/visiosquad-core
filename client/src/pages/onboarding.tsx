import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Loader2, CheckCircle2, FileText, Copy, MessageSquare, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type OnboardingStep = 'documents' | 'complete';

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>('documents');
  const [waiverContent, setWaiverContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { club, updateClubDocuments } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSaveDocuments = async () => {
    if (!waiverContent || waiverContent.length < 10) {
      toast({ title: 'Please enter waiver content (at least 10 characters)', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const result = await updateClubDocuments(waiverContent);
    setIsLoading(false);
    
    if (result.success) {
      toast({ title: 'Documents saved successfully!' });
      setStep('complete');
    } else {
      toast({ title: result.error || 'Failed to save documents', variant: 'destructive' });
    }
  };

  const getInviteLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join?code=${club?.join_code}`;
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(getInviteLink());
    toast({ title: 'Invite link copied to clipboard!' });
  };

  const openSmsInvite = () => {
    const message = `Join ${club?.name} on VisioSport! Use code ${club?.join_code} or click here to sign the waiver and register: ${getInviteLink()}`;
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_blank');
  };

  const goToDashboard = () => {
    setLocation('/');
  };

  if (!club) {
    setLocation('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">VisioSport</h1>
          </div>
          <p className="text-muted-foreground">
            Setting up {club.name}
          </p>
        </div>

        {step === 'documents' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary mb-2">
                <FileText className="h-5 w-5" />
                <span className="text-sm font-medium">Step 1 of 2</span>
              </div>
              <CardTitle>Set Up Club Documents</CardTitle>
              <CardDescription>
                Create the waiver that parents and coaches must sign before joining
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="waiver">Club Waiver / Liability Agreement</Label>
                <Textarea
                  id="waiver"
                  placeholder="Enter your club's waiver text here. This will be shown to parents and coaches when they sign up.

Example: By signing this waiver, I acknowledge the inherent risks associated with athletic activities and agree to hold [Club Name] harmless from any liability..."
                  value={waiverContent}
                  onChange={(e) => setWaiverContent(e.target.value)}
                  className="min-h-[200px]"
                  data-testid="textarea-waiver"
                />
                <p className="text-xs text-muted-foreground">
                  This waiver will be presented to all new members during registration
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleSaveDocuments}
                disabled={isLoading || waiverContent.length < 10}
                data-testid="button-save-documents"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save and Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'complete' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary mb-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Setup Complete!</span>
              </div>
              <CardTitle>Your Club is Ready</CardTitle>
              <CardDescription>
                Share your club code with parents and coaches
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center p-6 bg-primary/10 rounded-xl">
                <p className="text-sm text-muted-foreground mb-2">Your Club Code</p>
                <p className="text-4xl font-mono font-bold tracking-widest text-primary" data-testid="text-club-code">
                  {club.join_code}
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={copyInviteLink}
                  data-testid="button-copy-link"
                >
                  <Copy className="h-4 w-4" />
                  Copy Invite Link
                  <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={openSmsInvite}
                  data-testid="button-sms-invite"
                >
                  <MessageSquare className="h-4 w-4" />
                  Send Text Invite
                  <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium">What happens next?</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Parents and coaches use your code to join</li>
                  <li>• They sign your waiver during registration</li>
                  <li>• You can manage everything from your dashboard</li>
                </ul>
              </div>

              <Button
                className="w-full"
                onClick={goToDashboard}
                data-testid="button-go-dashboard"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
