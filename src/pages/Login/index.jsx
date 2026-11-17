import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, LogIn, Phone, ShieldCheck, Sparkles, UserCheck, Eye, EyeOff, ArrowRight } from 'lucide-react';
import authService from '../../services/authService';
import { useGame } from '../../context/GameContext';
import { sfx } from '../../utils/sound';

export default function LoginPage({ onLoginSuccess, onGuestPlay }) {
  const { actions, notify } = useGame();
  const [mobile, setMobile] = useState('1234567890');
  const [countryCode, setCountryCode] = useState('91');
  const [password, setPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    sfx.click();

    try {
      const res = await authService.login({ mobile, country_code: countryCode, password });
      if (res.success) {
        sfx.bonus();
        const displayCoins = res.wallet !== undefined ? res.wallet : (res.user?.total_wallet || res.user?.wallet || 0);
        notify(`Welcome ${res.user?.username || 'Player'}! Logged in with ${displayCoins} coins`, 'good');
        // Sync exact live wallet coins from server response
        if (res.wallet !== undefined) {
          actions.setCoins(Number(res.wallet));
        }
        if (onLoginSuccess) {
          onLoginSuccess(res);
        }
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
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-4 bg-radial from-[#1e1540] via-[#110b26] to-[#080514]">
      {/* Background ambient neon glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-[#161030]/95 backdrop-blur-xl border-2 border-[#382b68] rounded-3xl p-5 sm:p-7 shadow-[0_10px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] z-10"
      >
        {/* Header Logo */}
        <div className="text-center mb-6">
          <motion.div
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block"
          >
            <h1 className="logo text-4xl sm:text-5xl leading-none text-arcade-gold font-display drop-shadow-[0_4px_12px_rgba(251,191,36,0.4)]">
              PLINKO!
            </h1>
          </motion.div>
          <p className="text-xs sm:text-sm font-display text-white/60 tracking-wider uppercase mt-1">
            Player Authentication & Wallet Sync
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[11px] font-display">
            <ShieldCheck size={13} />
            <span>Server: api.wingo4all.site (LIVE)</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-300 text-xs font-display flex items-center gap-2"
          >
            <span className="text-sm">⚠️</span>
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-3.5">
          {/* Mobile + Country Code Input */}
          <div>
            <label className="block text-[11px] font-display text-white/70 uppercase tracking-wider mb-1.5">
              Mobile Number
            </label>
            <div className="flex items-center gap-2">
              <div className="w-16 sm:w-20 shrink-0 flex items-center justify-center px-2 py-2.5 rounded-xl bg-[#1f1642] border border-[#3f3070] text-arcade-gold font-display text-xs font-bold shadow-inner">
                +{countryCode}
              </div>
              <div className="flex-1 relative flex items-center">
                <Phone size={15} className="absolute left-3 text-white/40 pointer-events-none" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Enter 10-digit mobile"
                  required
                  className="w-full bg-[#1b1338] border border-[#3f3070] focus:border-arcade-gold/80 rounded-xl pl-9 pr-3 py-2.5 text-white font-display text-xs sm:text-sm tracking-wider focus:outline-none transition shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-[11px] font-display text-white/70 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock size={15} className="absolute left-3 text-white/40 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full bg-[#1b1338] border border-[#3f3070] focus:border-arcade-gold/80 rounded-xl pl-9 pr-10 py-2.5 text-white font-display text-xs sm:text-sm tracking-wider focus:outline-none transition shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-white/40 hover:text-white transition cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Login Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-display text-sm tracking-widest uppercase font-bold text-white bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 border border-emerald-400/50 shadow-[0_4px_16px_rgba(16,185,129,0.4)] hover:brightness-110 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={16} />
                <span>LOGIN TO PLINKO</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#312558]" />
          </div>
          <span className="relative px-3 bg-[#161030] text-[10px] font-display text-white/40 uppercase tracking-wider">
            OR TEST WITH DEMO
          </span>
        </div>

        {/* 1-Click Instant Demo Login Button */}
        <button
          type="button"
          onClick={handleInstantDemoLogin}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl font-display text-xs tracking-wider uppercase font-bold text-[#451a03] bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 border border-amber-300 shadow-[0_4px_14px_rgba(251,191,36,0.3)] hover:brightness-110 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2"
        >
          <Sparkles size={14} className="text-amber-800" />
          <span>⚡ 1-CLICK INSTANT DEMO LOGIN</span>
        </button>

        {/* Guest Play Button */}
        {onGuestPlay && (
          <button
            type="button"
            onClick={onGuestPlay}
            className="w-full mt-2.5 py-2 px-3 text-center text-xs font-display text-white/50 hover:text-white transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>Play as Guest without Login</span>
            <ArrowRight size={13} />
          </button>
        )}

        {/* Footer credentials note */}
        <div className="mt-4 pt-3 border-t border-[#251b47] text-center">
          <p className="text-[10px] font-display text-white/40">
            Demo Credentials: <span className="text-arcade-gold">1234567890</span> / <span className="text-arcade-gold">12345678</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
