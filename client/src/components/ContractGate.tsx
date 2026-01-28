import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Shield, FileSignature, FileText, Clock, ExternalLink, Loader2 } from 'lucide-react';

export function ContractGate() {
  const { user, club, setUser } = useAuth();
  const { toast } = useToast();
  const [submittedMethod, setSubmittedMethod] = useState<'digital' | 'paper' | null>(null);

  const updateContractStatusMutation = useMutation({
    mutationFn: async (method: 'digital' | 'paper') => {
      const response = await apiRequest('PATCH', '/api/my-contract-status', { method });
      return response.json();
    },
    onSuccess: (data) => {
      setUser(data);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({ title: 'Contract status updated!' });
    },
    onError: () => {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    },
  });

  const handleSignDigitally = () => {
    if (club?.contract_url) {
      window.open(club.contract_url, '_blank');
    }
    setSubmittedMethod('digital');
    updateContractStatusMutation.mutate('digital');
  };

  const handlePaperCopy = () => {
    setSubmittedMethod('paper');
    updateContractStatusMutation.mutate('paper');
  };

  // Contract compliance is enabled if either URL or instructions are set
  const contractComplianceEnabled = !!(club?.contract_url || club?.contract_instructions);
  
  if (!contractComplianceEnabled) {
    return null;
  }

  if (user?.contract_status === 'verified') {
    return null;
  }
  
  const hasDigitalSigningOption = !!club?.contract_url;

  if (user?.contract_status === 'pending') {
    return (
      <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <Clock className="h-5 w-5" />
            Contract Pending Verification
          </CardTitle>
          <CardDescription>
            Thank you for signing! Your contract is awaiting verification by a coach or director.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Your registration will be unlocked once a coach verifies your signature.</AlertTitle>
            <AlertDescription>
              If you have any questions, please contact your club director.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-500 bg-red-50 dark:bg-red-950/20 mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <Shield className="h-5 w-5" />
          Contract Signature Required
        </CardTitle>
        <CardDescription>
          You must sign the club contract before you can access all features. Please choose one of the options below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {club.contract_instructions && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>{club.contract_instructions}</AlertDescription>
          </Alert>
        )}

        <div className={`grid gap-4 ${hasDigitalSigningOption ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-md'}`}>
          {hasDigitalSigningOption && (
            <Card className="hover-elevate cursor-pointer" onClick={handleSignDigitally}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" />
                  Sign Digitally
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Open the contract in a new tab and sign it electronically.
                </p>
                <Button
                  className="w-full"
                  disabled={updateContractStatusMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSignDigitally();
                  }}
                  data-testid="button-sign-digitally"
                >
                  {updateContractStatusMutation.isPending && submittedMethod === 'digital' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Sign Digitally
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="hover-elevate cursor-pointer" onClick={handlePaperCopy}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                I Signed a Paper Copy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                I have already signed a physical paper copy of the contract.
              </p>
              <Button
                variant={hasDigitalSigningOption ? "outline" : "default"}
                className="w-full"
                disabled={updateContractStatusMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePaperCopy();
                }}
                data-testid="button-paper-copy"
              >
                {updateContractStatusMutation.isPending && submittedMethod === 'paper' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                I Signed a Paper Copy
              </Button>
            </CardContent>
          </Card>
        </div>

        <Alert variant="default" className="bg-muted">
          <Shield className="h-4 w-4" />
          <AlertTitle>Your registration will be unlocked once a coach verifies your signature.</AlertTitle>
          <AlertDescription>
            After signing, your status will change to "Pending" until a coach or director verifies your contract.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
