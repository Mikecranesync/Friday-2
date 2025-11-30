import React, { useState } from 'react';
import { AuthService } from '../services/revenueCat';
import { ShieldCheck, User, Sparkles, ArrowRight, Loader2 } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'paywall'>('login');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    
    setLoading(true);
    setError(null);

    try {
      const auth = AuthService.getInstance();
      await auth.initialize(userId);
      
      // In a real app, we would check entitlement here.
      // const info = await auth.getCustomerInfo();
      // if (info?.entitlements.active['pro']) { onLoginSuccess(); return; }
      
      // Proceed to Paywall/Trial screen
      setStep('paywall');
    } catch (err) {
      console.error(err);
      setError("Connection failed. Please check your internet or API configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      // Simulate purchase/trial start
      const success = await AuthService.getInstance().purchaseMock();
      if (success) {
        onLoginSuccess();
      }
    } catch (err) {
      setError("Transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-space relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 z-10">
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 mb-4 ring-1 ring-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
            <Sparkles className="text-cyan-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">FRIDAY</h1>
          <p className="text-slate-400 text-sm tracking-widest uppercase">Voice Intelligence System</p>
        </div>

        {error && (
            <div className="mb-6 p-3 bg-red-900/30 border border-red-800 rounded text-red-200 text-sm text-center">
                {error}
            </div>
        )}

        {step === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">User Identification</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                  <User size={18} />
                </div>
                <input 
                  type="text" 
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter User ID (e.g. TestUser01)"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cyan-900/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>Initialize Session <ArrowRight size={20} /></>}
            </button>
            
            <p className="text-center text-xs text-slate-600">
              By connecting, you agree to the usage terms of the Friday Protocol.
            </p>
          </form>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 relative overflow-hidden group hover:border-cyan-500/50 transition-colors cursor-pointer">
                <div className="absolute top-0 right-0 bg-cyan-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                    FREE TRIAL
                </div>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-white">Pro Access</h3>
                        <p className="text-slate-400 text-sm">Unlock full capabilities</p>
                    </div>
                    <ShieldCheck className="text-cyan-400" size={28} />
                </div>
                <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-sm text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div> Gemini 2.5 Live Audio
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div> Email & Calendar Integration
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div> Real-time Web Search
                    </li>
                </ul>
                <div className="text-2xl font-bold text-white mb-1">$0.00 <span className="text-sm font-normal text-slate-500">/ 7 days</span></div>
                <div className="text-xs text-slate-500">Then $9.99/mo</div>
             </div>

             <button 
                onClick={handleStartTrial}
                disabled={loading}
                className="w-full bg-white text-slate-950 font-bold py-3.5 rounded-xl shadow-lg hover:bg-slate-200 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
             >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Start 7-Day Free Trial'}
             </button>
             
             <button onClick={() => setStep('login')} className="w-full text-slate-500 text-sm hover:text-slate-300 transition-colors">
                Back to Login
             </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginScreen;