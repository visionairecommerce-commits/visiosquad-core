import { useAthlete } from '@/contexts/AthleteContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { isAthleteAccessLocked } from '@shared/schema';

export function AthleteSwitcher() {
  const { athletes, activeAthlete, setActiveAthlete } = useAthlete();

  if (athletes.length === 0) {
    return null;
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {athletes.map((athlete) => {
        const isActive = activeAthlete?.id === athlete.id;
        const isLocked = isAthleteAccessLocked(athlete.paid_through_date);

        return (
          <Button
            key={athlete.id}
            variant="ghost"
            className={cn(
              'h-auto py-2 px-3 gap-2',
              isActive && 'bg-background shadow-sm'
            )}
            onClick={() => setActiveAthlete(athlete)}
            data-testid={`button-athlete-${athlete.id}`}
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(athlete.first_name, athlete.last_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">
              {athlete.first_name}
            </span>
            {isLocked && (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </Button>
        );
      })}
    </div>
  );
}
