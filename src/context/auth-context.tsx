'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Company, CompanyMember, CompanyRole } from '@/types/database';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  activeCompany: Company | null;
  activeRole: CompanyRole | null;
  companies: Company[];
  memberships: CompanyMember[];
  isLoading: boolean;
  switchCompany: (companyId: string) => void;
  refreshTenantData: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  activeCompany: null,
  activeRole: null,
  companies: [],
  memberships: [],
  isLoading: true,
  switchCompany: () => {},
  refreshTenantData: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [activeRole, setActiveRole] = useState<CompanyRole | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [memberships, setMemberships] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const loadTenantData = useCallback(async (currentUser: User) => {
    try {
      // Query memberships with embedded company data
      const { data, error } = await supabase
        .from('company_members')
        .select(`
          id,
          user_id,
          company_id,
          role,
          created_at,
          companies:company_id (
            id,
            name,
            legal_name,
            country,
            tax_id,
            base_currency,
            created_at
          )
        `)
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error fetching company memberships:', error);
        setMemberships([]);
        setCompanies([]);
        setActiveCompany(null);
        setActiveRole(null);
        return;
      }

      const validMemberships: CompanyMember[] = [];
      const userCompanies: Company[] = [];

      if (data && data.length > 0) {
        data.forEach((item: any) => {
          if (item.companies) {
            const company = Array.isArray(item.companies) ? item.companies[0] : item.companies;
            if (company) {
              validMemberships.push({
                id: item.id,
                user_id: item.user_id,
                company_id: item.company_id,
                role: item.role as CompanyRole,
                created_at: item.created_at,
                company,
              });
              userCompanies.push(company);
            }
          }
        });
      }

      setMemberships(validMemberships);
      setCompanies(userCompanies);

      if (userCompanies.length > 0) {
        // Retrieve stored active company ID if present
        const storedCompanyId = typeof window !== 'undefined' ? localStorage.getItem('kounta_active_company_id') : null;
        const matched = validMemberships.find((m) => m.company_id === storedCompanyId);

        if (matched && matched.company) {
          setActiveCompany(matched.company);
          setActiveRole(matched.role);
        } else {
          setActiveCompany(validMemberships[0].company || null);
          setActiveRole(validMemberships[0].role);
          if (typeof window !== 'undefined') {
            localStorage.setItem('kounta_active_company_id', validMemberships[0].company_id);
          }
        }
      } else {
        setActiveCompany(null);
        setActiveRole(null);
      }
    } catch (err) {
      console.error('Failed to load tenant data:', err);
    }
  }, [supabase]);

  const refreshTenantData = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      setUser(currentUser);
      await loadTenantData(currentUser);
    } else {
      setUser(null);
      setActiveCompany(null);
      setActiveRole(null);
      setCompanies([]);
      setMemberships([]);
    }
  }, [supabase, loadTenantData]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setIsLoading(true);
      const { data: { user: initialUser } } = await supabase.auth.getUser();

      if (!mounted) return;

      if (initialUser) {
        setUser(initialUser);
        await loadTenantData(initialUser);
      } else {
        setUser(null);
        setActiveCompany(null);
        setActiveRole(null);
        setCompanies([]);
        setMemberships([]);
      }
      setIsLoading(false);
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setActiveCompany(null);
        setActiveRole(null);
        setCompanies([]);
        setMemberships([]);
        setIsLoading(false);
      } else if (session?.user) {
        setUser(session.user);
        await loadTenantData(session.user);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadTenantData]);

  // Route control based on company membership
  useEffect(() => {
    if (isLoading) return;

    if (user) {
      const isCurrentlyOnboarding = pathname === '/onboarding';
      const isAuthPage = pathname.startsWith('/auth');

      if (companies.length === 0 && !isCurrentlyOnboarding) {
        router.push('/onboarding');
      } else if (companies.length > 0 && (isCurrentlyOnboarding || isAuthPage)) {
        router.push('/dashboard');
      }
    }
  }, [user, companies, isLoading, pathname, router]);

  const switchCompany = (companyId: string) => {
    const membership = memberships.find((m) => m.company_id === companyId);
    if (membership && membership.company) {
      setActiveCompany(membership.company);
      setActiveRole(membership.role);
      if (typeof window !== 'undefined') {
        localStorage.setItem('kounta_active_company_id', companyId);
      }
      router.refresh();
    }
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kounta_active_company_id');
    }
    await supabase.auth.signOut();
    setUser(null);
    setActiveCompany(null);
    setActiveRole(null);
    setCompanies([]);
    setMemberships([]);
    router.push('/auth');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeCompany,
        activeRole,
        companies,
        memberships,
        isLoading,
        switchCompany,
        refreshTenantData,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
