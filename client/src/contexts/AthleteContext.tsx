import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Athlete } from '@shared/schema';

interface AthleteContextType {
  activeAthlete: Athlete | null;
  athletes: Athlete[];
  setActiveAthlete: (athlete: Athlete | null) => void;
  setAthletes: (athletes: Athlete[]) => void;
}

const AthleteContext = createContext<AthleteContextType | undefined>(undefined);

export function AthleteProvider({ children }: { children: ReactNode }) {
  const [activeAthlete, setActiveAthlete] = useState<Athlete | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);

  return (
    <AthleteContext.Provider value={{ activeAthlete, athletes, setActiveAthlete, setAthletes }}>
      {children}
    </AthleteContext.Provider>
  );
}

export function useAthlete() {
  const context = useContext(AthleteContext);
  if (context === undefined) {
    throw new Error('useAthlete must be used within an AthleteProvider');
  }
  return context;
}
