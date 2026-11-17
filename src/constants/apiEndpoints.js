// Central API Endpoints definition as per standards
export const API_ENDPOINTS = {
  // 1. Game Config: 9 Multipliers list, Chips buttons list, Min/Max bet
  CONFIG: '/api/plinko/config',

  // 2. Session Init (Handshake): Token verify, user profile, wallet balance, progress
  SESSION_INIT: '/api/plinko/session/init',

  // 3. Drop Ball (Place Bet): Deduct bet from wallet, get server seed + betId
  DROP_BET: '/api/plinko/bet/drop',

  // 4. Settle Bet (Outcome): Ball land hone par payout wallet me credit karna
  SETTLE_BET: '/api/plinko/bet/settle',

  // 5. My Bet History: User ki personal drops aur win/loss history with pagination
  MY_BET_HISTORY: '/api/plinko/bets/my-history',

  // 6. Live Bets Feed: Real + simulated players ki live winning feed
  LIVE_BETS_FEED: '/api/plinko/bets/live',

  // 7. Game Action: Cashout, Ascension, Slot level-up aur state sync
  GAME_ACTION: '/api/plinko/game/action',
};

export default API_ENDPOINTS;
