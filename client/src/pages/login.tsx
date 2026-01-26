import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@shared/schema';
import { Trophy, Users, ClipboardList, Home } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    if (selectedRole) {
      login(email || `${selectedRole}@visiosport.com`, selectedRole);
      setLocation('/');
    }
  };

  const roles: { role: UserRole; title: string; description: string; icon: typeof Trophy }[] = [
    { role: 'admin', title: 'Club Admin', description: 'Manage programs, teams, and payments', icon: ClipboardList },
    { role: 'coach', title: 'Coach', description: 'Track attendance and manage sessions', icon: Users },
    { role: 'parent', title: 'Parent', description: 'View schedules and register athletes', icon: Home },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">VisioSport</h1>
          </div>
          <p className="text-muted-foreground">
            Sports management platform for teams and athletes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Select your role to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
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
              <Label>Select Role</Label>
              <div className="grid gap-2">
                {roles.map(({ role, title, description, icon: Icon }) => (
                  <Button
                    key={role}
                    variant={selectedRole === role ? 'default' : 'outline'}
                    className="h-auto py-3 px-4 justify-start gap-3"
                    onClick={() => setSelectedRole(role)}
                    data-testid={`button-role-${role}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">{title}</div>
                      <div className="text-xs opacity-70">{description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!selectedRole}
              onClick={handleLogin}
              data-testid="button-login"
            >
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Demo mode - select any role to explore
        </p>
      </div>
    </div>
  );
}
