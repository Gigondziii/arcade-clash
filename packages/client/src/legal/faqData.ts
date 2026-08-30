export type FAQCategory = {
  id: string
  title: string
  description: string
  icon: string
}

export type FAQItem = {
  id: string
  categoryId: string
  question: string
  answer: string
  tags: string[]
  relatedPolicySlug?: string
  relatedPolicyLabel?: string
}

export const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Basic concepts, game modes, and how to start playing on Fugluck.',
    icon: '🚀',
  },
  {
    id: 'playing-matches',
    title: 'Playing Matches',
    description: 'Matchmaking, rules, scoring, disconnects, and winner determination.',
    icon: '🎮',
  },
  {
    id: 'diamonds-and-wallet',
    title: 'Diamonds & Wallet',
    description: 'Understanding COINS vs DIAMONDS, ledger balances, and transactions.',
    icon: '💎',
  },
  {
    id: 'fairness-and-security',
    title: 'Fairness & Anti-Cheat',
    description: 'How server verification works, anti-cheat detection, and fair play.',
    icon: '🛡️',
  },
  {
    id: 'account-and-login',
    title: 'Account & Security',
    description: 'Registration, email verification, passwords, and security.',
    icon: '🔐',
  },
  {
    id: 'friends-and-social',
    title: 'Friends & Social',
    description: 'Friend requests, inviting friends to private matches, and links.',
    icon: '👥',
  },
  {
    id: 'privacy-and-data',
    title: 'Privacy & Data Rights',
    description: 'Personal data protection, account closure, and data requests.',
    icon: '📜',
  },
  {
    id: 'support-and-help',
    title: 'Support & Inquiries',
    description: 'Disputes, reporting bugs, and getting in touch with our team.',
    icon: '💬',
  },
]

export const FAQ_ITEMS: FAQItem[] = [
  // Getting Started
  {
    id: 'what-is-fugluck',
    categoryId: 'getting-started',
    question: 'What is Fugluck?',
    answer:
      'Fugluck is a competitive online arcade platform where players compete head-to-head in fast, skill-based retro games. All matches are 100% server-authoritative and deterministic, ensuring that pure player skill decides every outcome.',
    tags: ['about', 'platform', 'introduction', 'basics'],
    relatedPolicySlug: 'about',
    relatedPolicyLabel: 'About Fugluck',
  },
  {
    id: 'is-fugluck-free',
    categoryId: 'getting-started',
    question: 'Is Fugluck free to play?',
    answer:
      'Yes! You can play offline in Practice Mode or compete in online multiplayer matches using COINS (our free virtual currency). Every new player receives 1,000 COINS upon registration, and coin balances are automatically topped off to 1,000 every month.',
    tags: ['free', 'cost', 'practice', 'coins'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Competition Rules',
  },
  {
    id: 'what-is-practice-mode',
    categoryId: 'getting-started',
    question: 'What is Practice Mode?',
    answer:
      'Practice Mode lets you play any arcade game locally without queueing for an opponent or wagering balances. It is ideal for warming up, mastering game physics, and learning obstacle patterns.',
    tags: ['practice', 'offline', 'single player', 'training'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Game Rules',
  },
  {
    id: 'coins-vs-diamonds',
    categoryId: 'getting-started',
    question: 'What is the difference between Coins and Diamonds?',
    answer:
      'COINS are 100% free virtual play money (0% rake, topped off monthly, no cash value). DIAMONDS are our premium competitive currency intended for real-value staking skill matches with a 5% platform rake.',
    tags: ['coins', 'diamonds', 'currencies', 'difference'],
    relatedPolicySlug: 'diamonds',
    relatedPolicyLabel: 'Diamond & Wallet Terms',
  },

  // Playing Matches
  {
    id: 'how-matchmaking-works',
    categoryId: 'playing-matches',
    question: 'How does matchmaking work?',
    answer:
      'When you click "Find Opponent", select your game, currency, and stake. Our matchmaking engine isolates queues by composite key (gameId:currency:stake). You will be paired only with an opponent requesting the exact same game, currency, and wager amount.',
    tags: ['matchmaking', 'queue', 'stakes', 'pairing'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Matchmaking Rules',
  },
  {
    id: 'how-is-winner-determined',
    categoryId: 'playing-matches',
    question: 'How is the match winner determined?',
    answer:
      'Both players play through the synchronized level generated from a shared random seed. When both players complete their run, the server verifies input logs and awards the win to the player with the higher verified score.',
    tags: ['winner', 'score', 'outcome', 'payout'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Competition Rules',
  },
  {
    id: 'what-happens-in-draw',
    categoryId: 'playing-matches',
    question: 'What happens if a match ends in a draw (tie)?',
    answer:
      'If both players achieve the exact same verified score, the match concludes as a Draw. The database settlement engine immediately issues a 100% refund of the staked entry amount to both players with 0% fees deducted.',
    tags: ['draw', 'tie', 'refund', 'equal score'],
    relatedPolicySlug: 'refunds',
    relatedPolicyLabel: 'Refund Policy',
  },
  {
    id: 'what-happens-on-disconnect',
    categoryId: 'playing-matches',
    question: 'What happens if I disconnect during a match?',
    answer:
      'If your connection drops, Fugluck provides a 10-second grace window to reconnect and resume the match seamlessly. If you cannot reconnect within 10 seconds, the match is recorded as a forfeit in favor of the connected opponent.',
    tags: ['disconnect', 'connection', 'forfeit', 'grace window'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Competition Rules',
  },
  {
    id: 'what-is-voided-match',
    categoryId: 'playing-matches',
    question: 'What is a voided match?',
    answer:
      'A voided match is an interrupted match that could not reach a natural conclusion due to a server restart or technical fault. Our crash recovery engine automatically marks the match VOIDED and issues full stake refunds to both players.',
    tags: ['void', 'interruption', 'server restart', 'crash recovery'],
    relatedPolicySlug: 'refunds',
    relatedPolicyLabel: 'Refund Policy',
  },

  // Diamonds & Wallet
  {
    id: 'how-do-diamonds-work',
    categoryId: 'diamonds-and-wallet',
    question: 'How do Diamonds work?',
    answer:
      'Diamonds are used to enter competitive matches. When you win a Diamond match, you receive the full pot minus a 5% platform rake fee. Your balance is tracked securely in an append-only database ledger.',
    tags: ['diamonds', 'wallet', 'rake', 'balance'],
    relatedPolicySlug: 'diamonds',
    relatedPolicyLabel: 'Diamond & Wallet Terms',
  },
  {
    id: 'can-diamonds-be-withdrawn',
    categoryId: 'diamonds-and-wallet',
    question: 'Can Diamonds be cashed out for real money?',
    answer:
      'Cash-out functionality is in active development and regulatory review. When real-money payment processors are integrated, eligible Diamond winnings will be redeemable for real-money payouts subject to identity verification and platform terms.',
    tags: ['cash out', 'withdrawal', 'real money', 'payout'],
    relatedPolicySlug: 'withdrawals',
    relatedPolicyLabel: 'Withdrawal Policy',
  },
  {
    id: 'where-can-i-see-wallet-history',
    categoryId: 'diamonds-and-wallet',
    question: 'Where can I see my transaction and wallet history?',
    answer:
      'Navigate to the dedicated Wallet page (/wallet) by clicking your balance or avatar in the top navigation bar. The Transaction History table displays every credit, debit, wager escrow, victory payout, and refund in real time.',
    tags: ['wallet', 'history', 'ledger', 'transactions'],
    relatedPolicySlug: 'diamonds',
    relatedPolicyLabel: 'Wallet Terms',
  },

  // Fairness & Anti-Cheat
  {
    id: 'how-are-scores-verified',
    categoryId: 'fairness-and-security',
    question: 'How does Fugluck verify scores?',
    answer:
      'Clients submit a frame-by-frame input log (keystrokes and clicks) at match end. The Fugluck server headlessly runs the deterministic game engine using the match seed and input log to re-derive the score. Modified scores that do not match the physics simulation are rejected immediately.',
    tags: ['anti cheat', 'score verification', 'headless simulation', 'security'],
    relatedPolicySlug: 'fair-play',
    relatedPolicyLabel: 'Fair Play Policy',
  },
  {
    id: 'can-players-use-bots',
    categoryId: 'fairness-and-security',
    question: 'Can players use bots or automated scripts?',
    answer:
      'No. The use of macros, auto-clickers, bots, or modified client scripts is strictly prohibited. Our simulation engine and timing anomaly detectors identify and ban automated play automatically.',
    tags: ['bots', 'macros', 'cheating', 'banning'],
    relatedPolicySlug: 'fair-play',
    relatedPolicyLabel: 'Fair Play Policy',
  },
  {
    id: 'what-is-freeze-frame-detection',
    categoryId: 'fairness-and-security',
    question: 'What is freeze-frame anti-cheat detection?',
    answer:
      'If a client artificially pauses or slows the browser clock to gain reaction time, the server detects that real-world wall-clock time exceeds simulated physics time by more than 3 seconds. The run is automatically rejected with reason freeze_frame_detected.',
    tags: ['freeze frame', 'speedhack', 'anti cheat', 'detection'],
    relatedPolicySlug: 'fair-play',
    relatedPolicyLabel: 'Fair Play Policy',
  },

  // Account & Security
  {
    id: 'how-do-i-register',
    categoryId: 'account-and-login',
    question: 'How do I register an account?',
    answer:
      'Click "Sign up" in the top navigation bar, choose a unique username (3-20 characters), create a strong password (minimum 8 characters), and provide an optional email address for password recovery and verification. Check the agreement box to accept our Terms of Service and Privacy Policy.',
    tags: ['signup', 'register', 'account', 'create'],
    relatedPolicySlug: 'terms',
    relatedPolicyLabel: 'Terms of Service',
  },
  {
    id: 'why-verify-email',
    categoryId: 'account-and-login',
    question: 'Why should I verify my email address?',
    answer:
      'Email verification secures your account, allows you to recover your account if you forget your password, and ensures eligibility for social features and future real-money competitions.',
    tags: ['email', 'verification', 'security', 'recovery'],
    relatedPolicySlug: 'privacy',
    relatedPolicyLabel: 'Privacy Policy',
  },
  {
    id: 'how-to-reset-password',
    categoryId: 'account-and-login',
    question: 'How do I reset a forgotten password?',
    answer:
      'Click "Log in", then click "Forgot password?". Enter your registered email or username to receive a secure password reset link valid for 1 hour.',
    tags: ['password', 'reset', 'forgot password', 'recovery'],
    relatedPolicySlug: 'security',
    relatedPolicyLabel: 'Security Info',
  },
  {
    id: 'can-i-have-multiple-accounts',
    categoryId: 'account-and-login',
    question: 'Can I create multiple accounts?',
    answer:
      'No. Operating multiple accounts by a single individual is prohibited under our Terms of Service to prevent rating manipulation and matchmaking abuse.',
    tags: ['multiple accounts', 'puppet accounts', 'rules', 'one account'],
    relatedPolicySlug: 'terms',
    relatedPolicyLabel: 'Terms of Service',
  },

  // Friends & Social
  {
    id: 'how-friend-requests-work',
    categoryId: 'friends-and-social',
    question: 'How do friend requests work?',
    answer:
      'Visit the Friends page (/friends) and enter another player’s username to send a friend request. Once accepted, you can see their online status and send instant private match invitations.',
    tags: ['friends', 'friend requests', 'social', 'invites'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Game Rules',
  },
  {
    id: 'how-guest-invite-links-work',
    categoryId: 'friends-and-social',
    question: 'How do instant guest invite links work?',
    answer:
      'Click "Share Free-Play Link" in the game launch modal to generate an instant link (/invite/code). Anyone with the link can join your match directly from their browser without registration (at stake = 0).',
    tags: ['guest links', 'instant invite', 'free play', 'share'],
    relatedPolicySlug: 'rules',
    relatedPolicyLabel: 'Game Rules',
  },

  // Privacy & Data
  {
    id: 'what-data-is-stored',
    categoryId: 'privacy-and-data',
    question: 'What information does Fugluck store?',
    answer:
      'We store your username, salted password hash, optional email address, match history records, and append-only ledger entries. We do not store plain-text passwords or third-party advertising tracking cookies.',
    tags: ['privacy', 'data storage', 'information', 'cookies'],
    relatedPolicySlug: 'privacy',
    relatedPolicyLabel: 'Privacy Policy',
  },
  {
    id: 'how-to-close-account',
    categoryId: 'privacy-and-data',
    question: 'How do I close my account or request data deletion?',
    answer:
      'Submit a request via our Contact page (/contact) or visit Data Rights & Account Closure (/data-rights). We will delete your login credentials and personal identifiers while retaining anonymized ledger records for audit integrity.',
    tags: ['close account', 'delete data', 'account deletion', 'data rights'],
    relatedPolicySlug: 'data-rights',
    relatedPolicyLabel: 'Data Rights',
  },

  // Support
  {
    id: 'how-to-report-match-issue',
    categoryId: 'support-and-help',
    question: 'How do I report a suspicious match or score discrepancy?',
    answer:
      'Copy the match ID from your match history (visible on your Profile page) and reach out to our team via the Contact page (/contact). Our administrators will audit the seed and input log replay.',
    tags: ['report', 'dispute', 'cheating', 'support'],
    relatedPolicySlug: 'disputes',
    relatedPolicyLabel: 'Disputes Policy',
  },
  {
    id: 'how-to-contact-support',
    categoryId: 'support-and-help',
    question: 'How do I contact Fugluck support?',
    answer:
      'You can reach our team directly through our Contact page at /contact or browse our Help Center categories for instant guidance.',
    tags: ['contact', 'support', 'help desk', 'inquiries'],
    relatedPolicySlug: 'contact',
    relatedPolicyLabel: 'Contact Page',
  },
]
