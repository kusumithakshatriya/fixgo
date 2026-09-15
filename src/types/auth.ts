export type User = {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  location?: string;
};

export type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
};
