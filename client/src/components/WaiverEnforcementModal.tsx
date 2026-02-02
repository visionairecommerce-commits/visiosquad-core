import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, FileSignature, Shield, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WaiverStatus {
  waiver_required: boolean;
  waiver_signed_for_current_season: boolean;
  current_season_id: string | null;
  current_season_name: string | null;
  waiver_content: string | null;
}

export function WaiverEnforcementModal() {
  const { user, club, setUser } = useAuth();
  const { toast } = useToast();
  const [signedName, setSignedName] = useState('');
  const [agreedToWaiver, setAgreedToWaiver] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { data: waiverStatus, isLoading, isError, refetch } = useQuery<WaiverStatus>({
    queryKey: ['/api/my-waiver-status'],
    enabled: !!user && (user.role === 'parent' || user.role === 'coach'),
    refetchOnWindowFocus: true,
    retry: 2,
  });

  useEffect(() => {
    if (isError) {
      setIsOpen(true);
    } else if (waiverStatus && waiverStatus.waiver_required && !waiverStatus.waiver_signed_for_current_season) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [waiverStatus, isError]);

  const signWaiverMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/sign-waiver', {
        signed_name: signedName,
        season_id: waiverStatus?.current_season_id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (user) {
        setUser({ ...user, has_signed_documents: true });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/my-waiver-status'] });
      setIsOpen(false);
      toast({ title: 'Waiver signed successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to sign waiver', variant: 'destructive' });
    },
  });

  const handleSign = () => {
    if (!signedName.trim()) {
      toast({ title: 'Please type your full legal name', variant: 'destructive' });
      return;
    }
    if (!agreedToWaiver) {
      toast({ title: 'You must agree to the waiver terms', variant: 'destructive' });
      return;
    }
    signWaiverMutation.mutate();
  };

  if (isLoading) {
    return null;
  }

  if (isError) {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent 
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Unable to Verify Waiver Status
            </DialogTitle>
            <DialogDescription>
              We couldn't verify your waiver status. Please try again or contact your club administrator.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => refetch()} data-testid="button-retry-waiver-check">
            Try Again
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (!waiverStatus?.waiver_required) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {waiverStatus.current_season_name 
              ? `Waiver Required for ${waiverStatus.current_season_name}` 
              : 'Club Waiver Required'}
          </DialogTitle>
          <DialogDescription>
            You must sign the club waiver before you can access the platform.
            {waiverStatus.current_season_name && (
              <span className="block mt-1 text-muted-foreground">
                A new waiver signature is required for each season.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {waiverStatus.waiver_content ? (
            <ScrollArea className="h-64 rounded-md border p-4">
              <div className="whitespace-pre-wrap text-sm">
                {waiverStatus.waiver_content}
              </div>
            </ScrollArea>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The club has not yet set up waiver content. Please contact your club administrator.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="agree-waiver"
                checked={agreedToWaiver}
                onCheckedChange={(checked) => setAgreedToWaiver(checked === true)}
                data-testid="checkbox-agree-waiver"
              />
              <Label htmlFor="agree-waiver" className="text-sm leading-relaxed cursor-pointer">
                I have read, understand, and agree to the terms of this waiver. I acknowledge that this waiver
                is legally binding and that I am signing it voluntarily.
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signed-name">Type your full legal name to sign</Label>
              <Input
                id="signed-name"
                placeholder="Your full legal name"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                className="font-serif italic"
                data-testid="input-signed-name"
              />
            </div>

            <Button
              onClick={handleSign}
              disabled={!agreedToWaiver || !signedName.trim() || signWaiverMutation.isPending}
              className="w-full"
              data-testid="button-sign-waiver"
            >
              {signWaiverMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileSignature className="h-4 w-4 mr-2" />
              )}
              Sign Waiver
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
