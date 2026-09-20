import type { User } from '../types/auth';

// Mock backend service
class AuthService {
  async login(phone: string): Promise<void> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    console.log(`[MockAuth] OTP sent to ${phone}`);
  }

  async verifyOtp(phone: string, otp: string): Promise<User> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    // Accept 123456 as the dev OTP
    if (otp !== '123456') {
      throw new Error('Invalid OTP');
    }

    console.log(`[MockAuth] Verified ${phone}`);
    return {
      id: `usr_${Date.now()}`,
      phone,
    };
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    console.log(`[MockAuth] Profile updated for ${userId}`);
    return {
      id: userId,
      phone: data.phone || '',
      ...data,
    };
  }

  async logout(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    console.log('[MockAuth] Logged out');
  }
}

export const authService = new AuthService();
