import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'wouter';
import { ArrowLeft, Loader2, CheckCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import visioSquadLogo from '@assets/ChatGPT_Image_Jan_29,_2026,_09_28_16_PM_1769747467171.png';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({ title: 'Please enter your email address', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/auth/forgot-password', { email });
      setIsSubmitted(true);
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to send reset email. Please try again.',
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
              {isSubmitted ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Check Your Email
                </>
              ) : (
                'Reset Password'
              )}
            </CardTitle>
            <CardDescription>
              {isSubmitted 
                ? "We've sent you an email with instructions to reset your password."
                : "Enter your email address and we'll send you a link to reset your password."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSubmitted ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Mail className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">{email}</p>
                    <p className="text-muted-foreground">Check your inbox for the reset link</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Didn't receive an email? Check your spam folder or make sure you entered the correct email address.
                </p>
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsSubmitted(false);
                      setEmail('');
                    }}
                    data-testid="button-try-different-email"
                  >
                    Try a different email
                  </Button>
                  <Link href="/login">
                    <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-send-reset-link"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send Reset Link
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
