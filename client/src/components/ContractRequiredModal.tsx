import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Shield, FileText, CreditCard, ExternalLink, ArrowRight } from 'lucide-react';

interface ContractRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionDescription?: string;
}

export function ContractRequiredModal({ isOpen, onClose, actionDescription = 'register for this activity' }: ContractRequiredModalProps) {
  const { user, club } = useAuth();
  const [, setLocation] = useLocation();

  const needsContract = user?.contract_status === 'unsigned';
  const needsVerification = user?.contract_status === 'pending';
  const contractComplianceEnabled = !!(club?.contract_url || club?.contract_instructions);

  const handleGoToContracts = () => {
    onClose();
    setLocation('/contracts');
  };

  const handleSignDigitally = () => {
    if (club?.contract_url) {
      window.open(club.contract_url, '_blank');
    }
  };

  if (!contractComplianceEnabled) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Shield className="h-5 w-5" />
            Contract Required
          </DialogTitle>
          <DialogDescription>
            You need to complete your contract before you can {actionDescription}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {needsContract && (
            <Alert variant="destructive">
              <FileText className="h-4 w-4" />
              <AlertTitle>Contract Not Signed</AlertTitle>
              <AlertDescription>
                You must sign the club contract before registering for programs, teams, or events.
              </AlertDescription>
            </Alert>
          )}

          {needsVerification && (
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <Shield className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-700 dark:text-yellow-400">Contract Pending Verification</AlertTitle>
              <AlertDescription>
                Your contract signature is awaiting verification by a coach or director. 
                Please wait for approval before registering.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              What you need to do:
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Sign the club contract (digitally or paper copy)</li>
              <li>Wait for a coach or director to verify your signature</li>
              <li>Once verified, you can register for activities</li>
            </ol>
          </div>

          {club?.contract_instructions && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>{club.contract_instructions}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {club?.contract_url && needsContract && (
            <Button onClick={handleSignDigitally} data-testid="button-sign-contract-modal">
              <ExternalLink className="h-4 w-4 mr-2" />
              Sign Contract Digitally
            </Button>
          )}
          <Button 
            variant={club?.contract_url ? "outline" : "default"} 
            onClick={handleGoToContracts}
            data-testid="button-go-to-contracts"
          >
            Go to Contracts Page
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
