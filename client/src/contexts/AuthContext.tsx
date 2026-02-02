import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@shared/schema';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  club_id?: string | null;
  has_signed_documents: boolean;
  contract_status?: 'unsigned' | 'pending' | 'verified';
  contract_method?: 'digital' | 'paper';
  created_at: string;
}

interface Club {
  id: string;
  name: string;
  logo_url?: string;
  address?: string;
  join_code: string;
  contract_pdf_url?: string;
  waiver_content?: string;
  waiver_version?: number;
  contract_version?: number;
  contract_url?: string;
  contract_instructions?: string;
  onboarding_complete: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  club: Club | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsOnboarding?: boolean }>;
  logout: () => void;
  createClub: (name: string, sport: string, directorName: string, directorEmail: string, directorPassword: string) => Promise<{ success: boolean; error?: string }>;
  registerUser: (joinCode: string, fullName: string, email: string, password: string, role: 'coach' | 'parent') => Promise<{ success: boolean; error?: string; needsSignature?: boolean }>;
  signDocument: (documentType: 'contract' | 'waiver', signedName: string) => Promise<{ success: boolean; allSigned?: boolean }>;
  updateClubDocuments: (waiverContent: string, contractPdfUrl?: string) => Promise<{ success: boolean; error?: string }>;
  completeOnboarding: () => Promise<{ success: boolean; error?: string }>;
  setUser: (user: User | null) => void;
  setClub: (club: Club | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedSession = localStorage.getItem('visiosport_session');
    if (savedSession) {
      try {
        const { user: savedUser, club: savedClub } = JSON.parse(savedSession);
        setUser(savedUser);
        setClub(savedClub);
      } catch (e) {
        localStorage.removeItem('visiosport_session');
      }
    }
    setIsLoading(false);
  }, []);

  const saveSession = (userData: User, clubData: Club | null) => {
    localStorage.setItem('visiosport_session', JSON.stringify({ user: userData, club: clubData }));
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; needsOnboarding?: boolean }> => {
    try {
      const response = await apiRequest('POST', '/api/auth/login', { email, password });
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      
      setUser(data.user);
      setClub(data.club);
      saveSession(data.user, data.club);
      
      if (data.user.role === 'admin' && data.club && !data.club.onboarding_complete) {
        return { success: true, needsOnboarding: true };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Connection failed' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setClub(null);
    localStorage.removeItem('visiosport_session');
  };

  const createClub = async (name: string, sport: string, directorName: string, directorEmail: string, directorPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiRequest('POST', '/api/auth/create-club', {
        name,
        sport,
        director_name: directorName,
        director_email: directorEmail,
        director_password: directorPassword,
      });
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to create club' };
      }
      
      setUser(data.user);
      setClub(data.club);
      saveSession(data.user, data.club);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Connection failed' };
    }
  };

  const registerUser = async (joinCode: string, fullName: string, email: string, password: string, role: 'coach' | 'parent'): Promise<{ success: boolean; error?: string; needsSignature?: boolean }> => {
    try {
      const response = await apiRequest('POST', '/api/auth/register', {
        join_code: joinCode,
        full_name: fullName,
        email,
        password,
        role,
      });
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }
      
      setUser(data.user);
      setClub(data.club);
      saveSession(data.user, data.club);
      
      return { success: true, needsSignature: !data.user.has_signed_documents };
    } catch (error) {
      return { success: false, error: 'Connection failed' };
    }
  };

  const signDocument = async (documentType: 'contract' | 'waiver', signedName: string): Promise<{ success: boolean; allSigned?: boolean }> => {
    try {
      const response = await apiRequest('POST', '/api/auth/sign-documents', {
        document_type: documentType,
        signed_name: signedName,
      });
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false };
      }
      
      if (user && data.signatures?.waiver) {
        const updatedUser = { ...user, has_signed_documents: true };
        setUser(updatedUser);
        if (club) {
          saveSession(updatedUser, club);
        }
      }
      
      return { success: true, allSigned: data.all_signed };
    } catch (error) {
      return { success: false };
    }
  };

  const updateClubDocuments = async (waiverContent: string, contractPdfUrl?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!club) return { success: false, error: 'No club found' };
      
      const response = await apiRequest('PUT', `/api/clubs/${club.id}/documents`, {
        waiver_content: waiverContent,
        contract_pdf_url: contractPdfUrl,
      });
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to update documents' };
      }
      
      setClub(data);
      if (user) {
        saveSession(user, data);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Connection failed' };
    }
  };

  const completeOnboarding = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!club) return { success: false, error: 'No club found' };
      
      const response = await apiRequest('POST', `/api/clubs/${club.id}/complete-onboarding`, {});
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to complete onboarding' };
      }
      
      setClub(data);
      if (user) {
        saveSession(user, data);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Connection failed' };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      club, 
      isLoading, 
      login, 
      logout, 
      createClub, 
      registerUser, 
      signDocument, 
      updateClubDocuments,
      completeOnboarding,
      setUser,
      setClub
    }}>
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
