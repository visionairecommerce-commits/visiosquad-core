import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Club, UserRole } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  club: Club | null;
  isLoading: boolean;
  login: (email: string, role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users for development
const DEMO_CLUB: Club = {
  id: 'demo-club-1',
  name: 'Elite Sports Academy',
  created_at: new Date().toISOString(),
};

const DEMO_USERS: Record<UserRole, User> = {
  admin: {
    id: 'demo-admin-1',
    email: 'admin@elitesports.com',
    full_name: 'Sarah Johnson',
    role: 'admin',
    club_id: 'demo-club-1',
    created_at: new Date().toISOString(),
  },
  coach: {
    id: 'demo-coach-1',
    email: 'coach@elitesports.com',
    full_name: 'Mike Thompson',
    role: 'coach',
    club_id: 'demo-club-1',
    created_at: new Date().toISOString(),
  },
  parent: {
    id: 'demo-parent-1',
    email: 'parent@example.com',
    full_name: 'Jennifer Davis',
    role: 'parent',
    club_id: 'demo-club-1',
    created_at: new Date().toISOString(),
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved session
    const savedRole = localStorage.getItem('visiosport_role') as UserRole | null;
    if (savedRole && DEMO_USERS[savedRole]) {
      setUser(DEMO_USERS[savedRole]);
      setClub(DEMO_CLUB);
    }
    setIsLoading(false);
  }, []);

  const login = (email: string, role: UserRole) => {
    const demoUser = DEMO_USERS[role];
    setUser({ ...demoUser, email });
    setClub(DEMO_CLUB);
    localStorage.setItem('visiosport_role', role);
  };

  const logout = () => {
    setUser(null);
    setClub(null);
    localStorage.removeItem('visiosport_role');
  };

  const switchRole = (role: UserRole) => {
    if (DEMO_USERS[role]) {
      setUser(DEMO_USERS[role]);
      localStorage.setItem('visiosport_role', role);
    }
  };

  return (
    <AuthContext.Provider value={{ user, club, isLoading, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
