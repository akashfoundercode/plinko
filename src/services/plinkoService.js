// ============================================================================
// Plinko Game APIs Service (Frontend Player Endpoints)
// Handles all 7 API endpoints defined for the Plinko Arcade System
// ============================================================================

import api, { getAuthToken } from './api';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { START_COINS } from '../constants/gameConfig';

// In-memory fallback / mock store for offline or dev mode
let localBetCounter = 1000;
let localHistory = [];

const DEFAULT_CONFIG = {
  multipliers: [2, 1.5, 1.2, 1.2, 1, 1.2, 1.2, 1.5, 2],
  chips: [5, 10, 20, 50, 100, 200, 500, 1000],
  minBet: 1,
  maxBet: 100000,
  rows: 9,
  outMultiplier: 0,
};

export const plinkoService = {
  /**
   * 1. Game Config
   * GET /api/plinko/config
   * Loads 9 Multipliers list, Chips buttons list, Min/Max bet values
   */
  async getGameConfig() {
    const res = await api.get(API_ENDPOINTS.CONFIG);
    if (res.ok && res.data) {
      const d = res.data.data || res.data;
      return {
        success: true,
        data: {
          multipliers: d.slot_multipliers || d.multipliers || DEFAULT_CONFIG.multipliers,
          chips: d.chips || DEFAULT_CONFIG.chips,
          minBet: d.min_bet !== undefined ? d.min_bet : d.minBet || DEFAULT_CONFIG.minBet,
          maxBet: d.max_bet !== undefined ? d.max_bet : d.maxBet || DEFAULT_CONFIG.maxBet,
          isActive: d.is_active !== undefined ? d.is_active : true,
        },
        raw: res.data,
      };
    }
    // Fallback config
    return {
      success: true,
      data: DEFAULT_CONFIG,
      source: 'local_fallback',
    };
  },

  /**
   * 2. Session Init (Handshake)
   * POST /api/plinko/session/init
   * Verifies user token, returns user profile, wallet balance & game state
   */
  async initSession(token = getAuthToken()) {
    const payload = {
      token: token || 'guest_token',
      gameId: 'plinko-arcade',
      timestamp: Date.now(),
    };

    const res = await api.post(API_ENDPOINTS.SESSION_INIT, payload);
    if (res.ok && res.data) {
      const d = res.data.data || res.data;
      const user = d.user || d;
      const realCoins =
        user.total_wallet !== undefined
          ? Number(user.total_wallet)
          : user.wallet !== undefined
          ? Number(user.wallet)
          : undefined;

      return {
        success: true,
        user: {
          id: user.id || 1,
          username: user.username || 'Admin',
          mobile: user.mobile,
          wallet: realCoins,
          winningWallet: Number(user.winning_wallet || 0),
          avatar: '🎮',
        },
        wallet: {
          coins: realCoins,
          winningWallet: Number(user.winning_wallet || 0),
        },
        progress: d.gameState || d.progress || {
          slotLevels: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          ascensions: 0,
          investments: [],
        },
        raw: res.data,
      };
    }

    // Fallback local session if no server response
    const cachedUser = authService.getCachedUser();
    const cachedCoins =
      cachedUser?.total_wallet !== undefined
        ? Number(cachedUser.total_wallet)
        : cachedUser?.wallet !== undefined
        ? Number(cachedUser.wallet)
        : undefined;

    return {
      success: true,
      user: {
        id: cachedUser?.id || 'usr_guest',
        username: cachedUser?.username || 'GuestPlayer',
        avatar: '🎮',
      },
      wallet: {
        coins: cachedCoins,
        sp: 0,
      },
      progress: {
        slotLevels: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        ascensions: 0,
        investments: [],
      },
      source: 'local_fallback',
    };
  },

  /**
   * 3. Drop Ball (Place Bet)
   * POST /api/plinko/bet/drop
   * Deducts bet amount from user wallet, initiates server seed & outcome
   */
  async dropBallBet({ bet, tier = 0, currentCoins = 0 }) {
    const payload = {
      bet: Number(bet),
      tier: Number(tier),
      timestamp: Date.now(),
      clientSeed: Math.random().toString(36).substring(2, 15),
    };

    const res = await api.post(API_ENDPOINTS.DROP_BET, payload);
    if (res.ok && res.data) {
      const d = res.data.data || res.data;
      const serverWallet = d.wallet !== undefined ? Number(d.wallet) : undefined;
      return {
        success: true,
        betId: d.orderid || d.drop_id || d.bet_id || `bet_${Date.now()}`,
        orderid: d.orderid,
        drop_id: d.drop_id,
        bet: Number(bet),
        tier: Number(tier),
        wallet: serverWallet,
        targetSlot: d.target_slot !== undefined ? d.target_slot : d.targetSlot !== undefined ? d.targetSlot : d.slot,
        targetMult: d.target_mult !== undefined ? d.target_mult : d.targetMult !== undefined ? d.targetMult : d.mult,
        isOut: Boolean(d.is_out !== undefined ? d.is_out : d.isOut !== undefined ? d.isOut : (d.force_out || d.forceOut)),
        expectedPayout: d.expected_payout !== undefined ? d.expected_payout : d.expectedPayout !== undefined ? d.expectedPayout : d.payout,
        raw: res.data,
      };
    }

    // Fallback local drop calculation
    localBetCounter++;
    const betId = `bet_${Date.now()}_${localBetCounter}`;
    const newBalance = Math.max(0, currentCoins - bet);

    return {
      success: true,
      betId,
      bet: Number(bet),
      tier: Number(tier),
      serverSeed: 'srv_' + Math.random().toString(36).substring(2, 10),
      remainingBalance: newBalance,
      wallet: newBalance,
      source: 'local_fallback',
    };
  },

  /**
   * 4. Settle Bet (Outcome)
   * POST /api/plinko/bet/settle
   * Credits payout to user wallet immediately when ball hits the slot
   */
  async settleBet({ betId, slot, mult, payout, bet = 10, tier = 0, isOut = false, currentCoins = 0 }) {
    const payload = {
      orderid: betId,
      drop_id: betId,
      slot: Number(slot),
      mult: Number(mult),
      payout: Number(payout),
      bet: Number(bet),
      tier: Number(tier),
      is_out: Boolean(isOut),
      isOut: Boolean(isOut),
      settledAt: Date.now(),
    };

    const res = await api.post(API_ENDPOINTS.SETTLE_BET, payload);
    if (res.ok && res.data) {
      const d = res.data.data || res.data;
      const serverWallet = d.wallet !== undefined ? Number(d.wallet) : undefined;
      return {
        success: true,
        orderid: d.orderid || payload.orderid,
        payout: d.payout !== undefined ? Number(d.payout) : Number(payout),
        wallet: serverWallet,
        winningWallet: d.winning_wallet !== undefined ? Number(d.winning_wallet) : undefined,
        raw: res.data,
      };
    }

    // Local fallback history tracking
    const historyItem = {
      id: payload.orderid,
      time: Date.now(),
      tier: payload.tier,
      slot: payload.slot,
      mult: payload.mult,
      bet: payload.bet,
      payout: payload.payout,
      isOut: payload.isOut,
    };
    localHistory = [historyItem, ...localHistory].slice(0, 100);

    return {
      success: true,
      betId: payload.orderid,
      payout: payload.payout,
      creditedBalance: currentCoins + payload.payout,
      wallet: currentCoins + payload.payout,
      transactionId: `tx_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      source: 'local_fallback',
    };
  },

  /**
   * 5. My Bet History
   * GET /api/plinko/bets/my-history
   * Personal drops & win/loss records with pagination
   */
  async getMyBetHistory({ page = 1, limit = 20 } = {}) {
    const res = await api.get(API_ENDPOINTS.MY_BET_HISTORY, { page, limit });
    if (res.ok && res.data) {
      return res.data;
    }

    // Local fallback
    const start = (page - 1) * limit;
    const paginated = localHistory.slice(start, start + limit);
    return {
      success: true,
      history: paginated,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: localHistory.length,
      },
      source: 'local_fallback',
    };
  },

  /**
   * 6. Live Bets Feed
   * GET /api/plinko/bets/live
   * Live stream of global / simulated player winning bets
   */
  async getLiveBetsFeed({ limit = 15 } = {}) {
    const res = await api.get(API_ENDPOINTS.LIVE_BETS_FEED, { limit });
    if (res.ok && res.data) {
      const d = res.data.data || res.data;
      const bets = d.bets || d.liveBets || (Array.isArray(d) ? d : []);
      const onlineCount = d.onlineCount || 2450;
      return {
        success: true,
        onlineCount,
        liveBets: bets,
        raw: res.data,
      };
    }

    // Fallback: Generate dynamic realistic simulated player bets
    const players = ['Vikram_R', 'Rahul_99', 'Sneha_K', 'Aman_VIP', 'Pooja_88', 'Arjun_Pro', 'Rohit_X', 'Neha_Win'];
    const multipliers = [1.7, 1.4, 1.2, 1.0, 0.8, 1.0, 1.2, 1.4, 1.7];
    const bets = [10, 25, 50, 100, 250, 500];

    const mockLive = Array.from({ length: 8 }).map((_, i) => {
      const p = players[Math.floor(Math.random() * players.length)];
      const b = bets[Math.floor(Math.random() * bets.length)];
      const m = multipliers[Math.floor(Math.random() * multipliers.length)];
      const payout = Math.round(b * m);
      return {
        id: `live_${Date.now() - i * 1500}_${i}`,
        player: p,
        bet: b,
        mult: m,
        payout,
        tier: 0,
        time: Date.now() - i * 1500,
        isWin: payout >= b,
      };
    });

    return {
      success: true,
      liveBets: mockLive,
      source: 'local_fallback',
    };
  },

  /**
   * 7. Game Action (Cashout / Upgrades)
   * POST /api/plinko/game/action
   * Handles server-validated actions: Cashout, Ascension, Slot Upgrades, Sync
   */
  async executeGameAction({ action, payload = {} }) {
    const body = {
      action, // 'CASHOUT' | 'ASCEND' | 'UPGRADE_SLOT' | 'SYNC_STATE'
      payload,
      timestamp: Date.now(),
    };

    const res = await api.post(API_ENDPOINTS.GAME_ACTION, body);
    if (res.ok && res.data) {
      return res.data;
    }

    return {
      success: true,
      action,
      syncedAt: Date.now(),
      source: 'local_fallback',
    };
  },
};

export default plinkoService;
