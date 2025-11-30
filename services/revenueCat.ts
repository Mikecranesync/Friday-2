
// Use type-only import to avoid runtime dependency at module evaluation time
import type { CustomerInfo, PurchasesOfferings } from '@revenuecat/purchases-js';

const API_KEY = 'test_KdrJvaXdhrWRpuZevZlhxTCzjcR';

export class AuthService {
  private static instance: AuthService;
  private isConfigured = false;
  private useMock = false;
  private purchasesInstance: any = null;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async initialize(userId: string): Promise<void> {
    if (this.isConfigured) return;

    try {
      // Dynamic import to prevent app crash if module fails to resolve at startup
      const module = await import('@revenuecat/purchases-js');
      const Purchases = module.Purchases;
      
      await Purchases.configure(API_KEY, userId);
      this.purchasesInstance = Purchases.getSharedInstance();
      this.isConfigured = true;
      console.log('RevenueCat Configured');
    } catch (error) {
      console.warn('Failed to load RevenueCat SDK, falling back to mock mode:', error);
      this.useMock = true;
      this.isConfigured = true;
    }
  }

  public async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!this.isConfigured) return null;
    
    if (this.useMock) {
        return {
            entitlements: { all: {}, active: {} },
            activeSubscriptions: [],
            allPurchasedProductIdentifiers: [],
            latestExpirationDate: null,
            firstSeen: "2024-01-01",
            originalAppUserId: "mock-user",
            requestDate: "2024-01-01",
            managementURL: null,
            originalPurchaseDate: "2024-01-01",
            nonSubscriptionTransactions: [],
        } as any;
    }

    try {
        const customerInfo = await this.purchasesInstance.getCustomerInfo();
        return customerInfo;
    } catch (e) {
        console.error("Error fetching customer info", e);
        return null;
    }
  }

  public async getOfferings(): Promise<PurchasesOfferings | null> {
    if (!this.isConfigured) return null;
    
    if (this.useMock) return null;

    try {
      const offerings = await this.purchasesInstance.getOfferings();
      return offerings;
    } catch (error) {
      console.error('Error fetching offerings:', error);
      return null;
    }
  }

  public async purchaseMock(): Promise<boolean> {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // If we are in mock mode or just simulating the "purchase" action for the trial button
      return true;
  }
}
