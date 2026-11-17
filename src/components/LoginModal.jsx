import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, LogIn, Phone, ShieldCheck, Sparkles, Eye, EyeOff } from 'lucide-react';
import authService from '../services/authService';
import { useGame } from '../context/GameContext';
import { sfx } from '../utils/sound';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const { actions, notify } = useGame();
  const [mobile, setMobile] = useState('1234567890');
  const [countryCode, setCountryCode] = useState('91');
  const [password, setPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    sfx.click();

    try {
      const res = await authService.login({ mobile, country_code: countryCode, password });
      if (res.success) {
        sfx.bonus();
        notify(`Welcome ${res.user?.username || 'Player'}! Logged in with ${res.wallet || 8681} coins`, 'good');
        if (res.wallet !== undefined) {
          actions.setCoins(Number(res.wallet));
        }
        if (onLoginSuccess) onLoginSuccess(res);
        onClose();
      } else {
        sfx.error();
        setErrorMsg(res.error || 'Login failed. Please check mobile and password.');
      }
    } catch (err) {
      sfx.error();
      setErrorMsg(err.message || 'Network error occurred while logging in.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantDemoLogin = () => {
    setMobile('1234567890');
    setCountryCode('91');
    setPassword('12345678');
    handleLogin();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-[#171133] border-2 border-[#382b68] rounded-3xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Modal Title */}
          <div className="text-center mb-4">
            <h2 className="text-2xl font-display text-arcade-gold tracking-wide">
              PLAYER LOGIN
            </h2>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[10px] font-display">
              <ShieldCheck size={11} />
              <span>api.wingo4all.site</span>
            </div>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-3 p-2 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-300 text-xs font-display">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-[10px] font-display text-white/70 uppercase tracking-wider mb-1">
                Mobile Number
              </label>
              <div className="flex items-center gap-1.5">
                <div className="w-14 shrink-0 flex items-center justify-center py-2 rounded-xl bg-[#201744] border border-[#3f3070] text-arcade-gold font-display text-xs font-bold">
                  +{countryCode}
                </div>
                <div className="flex-1 relative flex items-center">
                  <Phone size={13} className="absolute left-3 text-white/40 pointer-events-none" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Enter mobile"
                    required
                    className="w-full bg-[#1b1338] border border-[#3f3070] focus:border-arcade-gold/80 rounded-xl pl-8 pr-2 py-2 text-white font-display text-xs tracking-wider focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-display text-white/70 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock size={13} className="absolute left-3 text-white/40 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full bg-[#1b1338] border border-[#3f3070] focus:border-arcade-gold/80 rounded-xl pl-8 pr-9 py-2 text-white font-display text-xs tracking-wider focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-white/40 hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-display text-xs tracking-wider uppercase font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 border border-emerald-400/50 shadow hover:brightness-110 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={14} />
                  <span>LOGIN</span>
                </>
              )}
            </button>
          </form>

          {/* Quick 1-Click Demo Login */}
          <button
            type="button"
            onClick={handleInstantDemoLogin}
            disabled={loading}
            className="w-full mt-2.5 py-2 rounded-xl font-display text-[11px] uppercase font-bold text-[#451a03] bg-gradient-to-r from-amber-400 to-yellow-400 border border-amber-300 hover:brightness-110 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
          >
            <Sparkles size={13} className="text-amber-800" />
            <span>⚡ 1-CLICK INSTANT DEMO LOGIN</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
