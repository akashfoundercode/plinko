import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings as SettingsIcon, Volume2, VolumeX, Wallet, LogIn, User } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { initAudio, sfx } from '../utils/sound';
import authService from '../services/authService';
import AnimatedNumber from './ui/AnimatedNumber';
import { CoinIcon } from './ui/CoinIcon';
import SettingsModal from './SettingsModal';
import WalletModal from './WalletModal';
import LoginModal from './LoginModal';

function CurrencyPill({ label, value, variant, onClick, className = '' }) {
  const sp = variant === 'sp';
  return (
    <div
      onClick={onClick}
      className={`currency-pill flex items-center gap-1.5 sm:gap-2 rounded-full pl-1 pr-2.5 sm:pr-3 py-0.5 sm:py-1 border-2 transition ${
        sp ? 'border-[#4a3a8a] bg-[#1a1338]' : 'border-[#5a4826] bg-[#1d1633] cursor-pointer hover:border-amber-400/80 hover:bg-[#261c42]'
      } shadow-[0_2px_0_#0f0b20,inset_0_1px_0_rgba(255,255,255,0.08)] ${className}`}
    >
      <span
        className={`grid place-items-center w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-full ${
          sp ? 'bg-gradient-to-b from-[#a855f7] to-[#7c3aed] ring-1 ring-purple-400' : 'bg-gradient-to-b from-[#fcd34d] to-[#f59e0b] ring-1 ring-amber-300'
        }`}
      >
        <CoinIcon size={16} variant={variant} spin={false} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </span>
      <div className="leading-tight min-w-0">
        <div className="text-[8px] sm:text-[9px] uppercase font-display text-white/60 tracking-wider whitespace-nowrap flex items-center gap-0.5">
          <span>{label}</span>
          {!sp && <span className="text-emerald-400 font-bold leading-none">+</span>}
        </div>
        <motion.div
          key={Math.floor(value)}
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          className="text-xs sm:text-base font-display text-white leading-none"
        >
          <AnimatedNumber value={value} />
        </motion.div>
      </div>
    </div>
  );
}

export default function Header() {
  const { state, actions, userSession } = useGame();
  const [showSettings, setShowSettings] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const soundOn = state.settings.sound;
  const isAuth = authService.isAuthenticated();
  const cachedUser = authService.getCachedUser();
  const username = userSession?.username || cachedUser?.username || (isAuth ? 'Admin' : null);

  return (
    <header className="h-[48px] sm:h-[52px] shrink-0 rounded-2xl bg-[#191333] border-2 border-[#2f2557] px-2.5 sm:px-4 py-1 flex items-center justify-between shadow-[0_3px_0_#100c24]">
      {/* Left: PLINKO! Logo & User Session Handshake Badge */}
      <div className="flex items-center gap-2">
        <motion.h1
          className="logo text-xl sm:text-2xl md:text-3xl leading-none -rotate-[1deg] select-none cursor-default font-display shrink-0"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          PLINKO!
        </motion.h1>
        {userSession && (
          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#140e2b] border border-[#2f2458] text-[11px] font-display text-white/70">
            <span>{userSession.avatar || '🎮'}</span>
            <span className="truncate max-w-[80px]">{userSession.username || 'Player'}</span>
          </div>
        )}
      </div>

      {/* Right: Currency Pills + Wallet Button + Sound + Settings */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <CurrencyPill
          label="COINS"
          value={state.coins}
          variant="coin"
          onClick={() => {
            sfx.click();
            setShowWallet(true);
          }}
        />

        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => {
            sfx.click();
            setShowWallet(true);
          }}
          className="flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-3 rounded-full bg-gradient-to-b from-[#10b981] to-[#059669] border border-[#34d399] font-display text-xs text-white shadow-[0_2px_0_#065f46] hover:brightness-110 active:translate-y-[1px] transition cursor-pointer"
        >
          <Wallet size={13} className="text-[#06382a]" />
          <span className="font-bold hidden sm:inline">WALLET</span>
          <span className="font-bold sm:hidden">+</span>
        </motion.button>

        {/* Login / User Status Button */}
        {isAuth ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Do you want to logout?')) {
                authService.logout();
                window.location.reload();
              }
            }}
            className="flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-2.5 rounded-full bg-[#201740] border border-[#4a3a78] font-display text-[11px] text-amber-300 hover:border-amber-400 transition cursor-pointer"
            title="Click to Logout"
          >
            <User size={12} className="text-amber-400" />
            <span className="max-w-[70px] truncate hidden sm:inline">{username}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              sfx.click();
              setShowLogin(true);
            }}
            className="flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-2.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-[#451a03] font-display text-[11px] font-bold shadow hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            <LogIn size={12} />
            <span>LOGIN</span>
          </button>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.06 }}
          aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
          onClick={() => {
            initAudio();
            actions.setSetting('sound', !soundOn);
            if (!soundOn) setTimeout(sfx.click, 30);
          }}
          className="grid place-items-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#241c46] border-2 border-[#3a2d6c] shadow-[0_2px_0_#100c24] text-arcade-purple shrink-0 hover:bg-[#2e2358] transition"
        >
          {soundOn ? <Volume2 size={14} className="sm:w-4 sm:h-4" /> : <VolumeX size={14} className="text-white/40 sm:w-4 sm:h-4" />}
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.06, rotate: 45 }}
          aria-label="Settings"
          onClick={() => {
            initAudio();
            sfx.click();
            setShowSettings(true);
          }}
          className="grid place-items-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#241c46] border-2 border-[#3a2d6c] shadow-[0_2px_0_#100c24] text-arcade-purple shrink-0 hover:bg-[#2e2358] transition"
        >
          <SettingsIcon size={14} className="sm:w-4 sm:h-4" />
        </motion.button>
      </div>

      <AnimatePresence>{showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}</AnimatePresence>
      <WalletModal open={showWallet} onClose={() => setShowWallet(false)} />
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </header>
  );
}
