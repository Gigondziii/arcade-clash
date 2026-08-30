import { CURRENT_POLICY_VERSIONS, type PolicyType } from '@fugluck/shared'

export type PolicySection = {
  id: string
  heading: string
  content: string[]
  note?: string
}

export type PolicyDocument = {
  type: PolicyType
  slug: string
  title: string
  subtitle: string
  lastUpdated: string
  version: string
  summary: string
  sections: PolicySection[]
  relatedSlugs: string[]
}

export const POLICIES: Record<string, PolicyDocument> = {
  terms: {
    type: 'TERMS',
    slug: 'terms',
    title: 'Terms of Service',
    subtitle: 'General Terms and Conditions governing use of the Fugluck platform.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.TERMS,
    summary:
      'These Terms of Service constitute a legally binding agreement between you and Fugluck. By creating an account or accessing the platform, you agree to these terms, including our server-authoritative matchmaking, anti-cheating, and currency rules.',
    sections: [
      {
        id: 'acceptance',
        heading: '1. Acceptance of Terms & Account Registration',
        content: [
          'By accessing, registering for, or playing on Fugluck, you affirm that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, you must not access or use the platform.',
          'To access certain features, including competitive matchmaking, wallet balance tracking, and social features, you must register for an account. You agree to provide accurate, current, and complete information during registration and to keep such information updated.',
          'You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify Fugluck immediately of any unauthorized access or security breach.',
          'Each individual is permitted to operate only one active player account. Creating multiple accounts or operating puppet accounts for the purpose of rating manipulation, matchmaking evasion, or bonus exploitation is strictly prohibited.',
        ],
      },
      {
        id: 'modes-and-gameplay',
        heading: '2. Platform Access & Game Modes',
        content: [
          'Fugluck provides skill-based arcade video games across multiple gameplay modes:',
          '• Practice Mode: Single-player offline or local play designed for skill acquisition. No wagers or financial transactions occur.',
          '• Free Play (Guest Instant Matches): Unauthenticated or peer-to-peer matches conducted at zero stake (stake = 0). Open to all eligible players without financial risk.',
          '• COIN Matches: Competitive matches played with COINS (our free virtual currency). Winner receives the prize pot with 0% platform rake. COINS have no cash value and cannot be redeemed for real money.',
          '• DIAMOND Matches: Real-value competitive matches staked with DIAMONDS. Match outcomes are determined entirely by player skill, speed, and precision.',
        ],
      },
      {
        id: 'server-authority',
        heading: '3. Server Authority, Seeding & Score Validation',
        content: [
          'All competitive matches on Fugluck are strictly server-authoritative. The Fugluck server generates and issues a cryptographically secure pseudo-random seed to both match participants simultaneously upon match start.',
          'Physics, obstacle placement, scoring events, and difficulty scaling run deterministically from the canonical seed at a fixed 60 FPS tick rate. Client display resolution does not alter gameplay physics or scoring distance (Fixed Virtual Viewport invariant).',
          'At match completion, clients submit an input log alongside their claimed score. The server headlessly simulates the entire match run to independently calculate and verify the authoritative score before settling match stakes.',
        ],
      },
      {
        id: 'outcomes-and-interruptions',
        heading: '4. Match Outcomes, Disconnects & Forfeits',
        content: [
          '• Victory: The player with the higher verified score wins the match and receives the prize pot minus the applicable platform rake fee.',
          '• Draws: If both players achieve identical verified scores, the match concludes as a Draw, and both players receive an exact 100% refund of their staked entry amounts.',
          '• Disconnects & Grace Windows: If a player disconnects during an active match, a 10-second reconnection grace period is granted. If the player fails to reconnect within the grace period, the match is recorded as a forfeit in favor of the connected opponent.',
          '• Server Interruptions: In the rare event of a server restart, crash, or unrecoverable network failure, active matches are automatically voided by the orphan recovery engine, and full stake refunds are credited to both players.',
        ],
      },
      {
        id: 'currencies-and-wallet',
        heading: '5. Virtual Currencies, Purchases & Cash-Outs',
        content: [
          'Fugluck operates a dual-currency ledger model: COINS (free-play virtual currency) and DIAMONDS (competitive staking currency).',
          'COINS are granted freely upon registration (1,000 COINS) and topped up monthly. COINS carry zero monetary value and cannot be exchanged, transferred, or cashed out.',
          'DIAMONDS represent competitive units that may be acquired via payment processors and used to enter competitive matches. Real-money Diamond purchases and cash-out/withdrawal functionality will be governed by our Diamond & Wallet Terms and Withdrawal Policy once payment gateway infrastructure is operational.',
        ],
      },
      {
        id: 'prohibited-conduct',
        heading: '6. Prohibited Conduct & Anti-Cheating',
        content: [
          'You agree not to engage in any prohibited activity, including but not limited to: running bots or automated input scripts; modifying client source code; memory injection; exploiting network latency or bugs; colluding with opponents; intentionally throwing matches; or attempting to manipulate the wallet ledger.',
          'Violation of these rules may result in immediate match disqualification, forfeiture of staked entries, account suspension, or permanent banning.',
        ],
      },
      {
        id: 'intellectual-property',
        heading: '7. Intellectual Property',
        content: [
          'All game code, graphic assets, animations, audio, logos, trademarks, and user interfaces on Fugluck are the proprietary intellectual property of Fugluck or its licensors. You are granted a limited, personal, revocable license to access and play the games for individual entertainment.',
        ],
      },
      {
        id: 'termination',
        heading: '8. Account Suspension & Termination',
        content: [
          'Fugluck reserves the right to suspend, restrict, or terminate any account that violates these Terms of Service, engages in fraudulent activity, or poses a security risk to other players. In the event of account closure, you may request data access in accordance with our Privacy Policy.',
        ],
      },
      {
        id: 'contact',
        heading: '9. Contact & Inquiries',
        content: [
          'For legal inquiries, terms interpretation, or general support, please visit our Help Center (/help) or submit an inquiry through our Contact page (/contact).',
        ],
      },
    ],
    relatedSlugs: ['privacy', 'rules', 'diamonds', 'fair-play', 'disputes'],
  },

  privacy: {
    type: 'PRIVACY',
    slug: 'privacy',
    title: 'Privacy Policy',
    subtitle: 'How Fugluck collects, uses, protects, and handles your personal information.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.PRIVACY,
    summary:
      'Fugluck is committed to player privacy and data transparency. We process only the information necessary to operate our accounts, verify game integrity, ensure financial ledger accuracy, and prevent cheating.',
    sections: [
      {
        id: 'information-collected',
        heading: '1. Information We Collect',
        content: [
          'We collect only the categories of information necessary to deliver and secure our services:',
          '• Account Information: Username, email address, password hash (salted using Argon2id / bcrypt; we never store plain-text passwords), and account creation timestamps.',
          '• Gameplay & Anti-Cheat Data: Match histories, authoritative scores, game seeds, and frame-by-frame input logs (keystrokes and mouse click coordinates) required to deterministically verify score authenticity.',
          '• Financial Ledger Records: Transaction timestamps, currency amounts (COINS/DIAMONDS), and balance mutation reason codes (e.g. signup grant, match escrow, victory payout).',
          '• Technical & Security Data: IP addresses for rate limiting and admin lockout protection, session tokens, and user agent strings.',
        ],
      },
      {
        id: 'how-we-use-data',
        heading: '2. How We Use Your Information',
        content: [
          'Your information is used strictly for:',
          '• Authenticating your identity and maintaining your active login session.',
          '• Operating matchmaking queues and pair-matching players.',
          '• Headlessly simulating gameplay input logs to detect bots, modified clients, and speedhacks.',
          '• Maintaining double-entry financial ledger accuracy and balance protection.',
          '• Communicating critical account notices (e.g. email verification, password reset links).',
        ],
      },
      {
        id: 'data-retention',
        heading: '3. Data Retention & Ledger Integrity',
        content: [
          '• Match logs and gameplay seeds are retained in matches_history to guarantee auditability and dispute resolution.',
          '• Financial ledger entries (ledger_entries) are immutable and append-only to preserve mathematical conservation of currency.',
          '• Verification and password reset tokens expire automatically after 24 hours and 1 hour respectively.',
        ],
      },
      {
        id: 'sharing-and-security',
        heading: '4. Information Sharing & Security Measures',
        content: [
          'We do not sell, rent, or monetize your personal data. We disclose information only to third-party infrastructure providers (e.g. cloud database hosting, transactional email delivery) who are under strict confidentiality obligations.',
          'We implement industry-standard technical safeguards, including HTTP-only cookies, PostgreSQL connection encryption (SSL/TLS), salted password hashing, and advisory-locked database transactions.',
        ],
      },
      {
        id: 'user-rights',
        heading: '5. Your Rights & Data Access Requests',
        content: [
          'You have the right to request a copy of your personal data, request correction of inaccurate profile data, or request account closure. For detailed instructions on exercising your data rights, please see our Data Rights & Account Closure page (/data-rights).',
        ],
      },
    ],
    relatedSlugs: ['terms', 'cookies', 'data-rights', 'security'],
  },

  cookies: {
    type: 'COOKIES',
    slug: 'cookies',
    title: 'Cookie & Storage Policy',
    subtitle: 'Transparent disclosure of browser storage, sessions, and cookies used on Fugluck.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.COOKIES,
    summary:
      'Fugluck utilizes strictly necessary cookies and local browser storage to provide secure session management, language preferences, and active match resumption. We do not use third-party advertising tracking cookies.',
    sections: [
      {
        id: 'storage-overview',
        heading: '1. What Storage Technologies We Use',
        content: [
          'Fugluck utilizes standard browser storage technologies:',
          '• HTTP-Only Session Cookies: Secure, server-set cookies (e.g., fugluck_session) used solely to maintain authenticated user sessions.',
          '• LocalStorage: Client-side storage used to remember your preferred language (en, ka, ru) and client-side UI preferences.',
          '• SessionStorage: Temporary browser memory used to store active match references so a match can be reconnected if you refresh during play.',
        ],
      },
      {
        id: 'strict-necessity',
        heading: '2. Strictly Necessary Classification',
        content: [
          'All cookies and storage items currently employed by Fugluck are strictly necessary for the technical operation, security, and authentication of the website.',
          'Because we do not deploy third-party advertising trackers or invasive marketing pixels, our storage usage qualifies as essential under major data protection frameworks.',
        ],
      },
      {
        id: 'managing-cookies',
        heading: '3. Managing Browser Storage',
        content: [
          'You can configure your browser settings to block or delete cookies. However, disabling essential cookies will prevent you from logging in, maintaining an authenticated session, or participating in matchmaking.',
        ],
      },
    ],
    relatedSlugs: ['privacy', 'security', 'terms'],
  },

  rules: {
    type: 'RULES',
    slug: 'rules',
    title: 'Competition & Game Rules',
    subtitle: 'Official gameplay, scoring, validation, and outcome rules across all Fugluck arenas.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.RULES,
    summary:
      'Every competitive match on Fugluck is governed by deterministic rules, synchronized seeds, fixed 60 FPS physics loops, and headless score validation to guarantee 100% fair and equal competition.',
    sections: [
      {
        id: 'skill-foundation',
        heading: '1. Skill-Based Competition Architecture',
        content: [
          'Fugluck games are pure skill competitions. Random elements (e.g., obstacle spawns, trivia question sequences, platform arrangements) are synchronized between opponents via a single server-issued random seed.',
          'Both players compete against identical obstacle patterns, identical physics constants, and identical scoring multipliers. No player receives an unfair positional or procedural advantage.',
        ],
      },
      {
        id: 'game-categories',
        heading: '2. Game Categories & Rules',
        content: [
          '• Runner Games (e.g., Neon Runner): Side-scrolling obstacle avoidance. Scoring is determined by distance traveled and coin pickups.',
          '• Reflex Timing Games (e.g., Pixel Ninja Dash, Cyber Hopper): Grid-based and platform-jumping reflex challenges requiring precise timing.',
          '• Arena Shooters (e.g., Space Blaster): 2D wave defense requiring target prioritization and evasion.',
          '• Quiz Arenas (e.g., Speed Trivia Clash, True/False Sprint): Timed trivia challenges where score scales dynamically with answering speed.',
        ],
      },
      {
        id: 'dynamic-scaling',
        heading: '3. Deterministic Dynamic Difficulty Scaling',
        content: [
          'All arcade mini-games implement standardized deterministic difficulty scaling derived strictly from tick count: difficultyScale = 1.0 + (tickCount / 5400)^1.4 * 1.5. At 90 seconds (5,400 ticks), velocity and spawn rates reach 2.5x speed while preserving 100% replay determinism.',
        ],
      },
      {
        id: 'settlement-rules',
        heading: '4. Winner Determination & Rake Structure',
        content: [
          '• Winner: The player with the higher verified score at match termination.',
          '• Prize Distribution (COINS): Winner receives 100% of the pot (0% rake).',
          '• Prize Distribution (DIAMONDS): Winner receives 95% of the pot (5% platform rake fee).',
          '• Ties & Draws: If scores are identical, both players receive a 100% stake refund.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'fair-play', 'diamonds', 'refunds'],
  },

  diamonds: {
    type: 'DIAMONDS',
    slug: 'diamonds',
    title: 'Diamond & Wallet Terms',
    subtitle: 'Economic principles, currency distinctions, and wallet rules for Fugluck.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.DIAMONDS,
    summary:
      'Learn how the Fugluck dual-currency model works. Understand the distinction between free COINS and competitive DIAMONDS, our append-only ledger, and future cash-out mechanics.',
    sections: [
      {
        id: 'dual-currency',
        heading: '1. Dual Currency Model: COINS vs DIAMONDS',
        content: [
          'Fugluck maintains strict architectural separation between our two currencies:',
          '• COINS: 100% free-play currency. Granted upon registration (1,000 COINS), refilled monthly, with 0% platform rake. COINS have no cash value, cannot be sold, and cannot be redeemed for real money.',
          '• DIAMONDS: Premium competitive staking currency designed for real-value skill matches. Staked in Diamond matches with a 5% platform rake fee. Eligible winnings may be submitted for cash-out once payout infrastructure is live.',
        ],
      },
      {
        id: 'append-only-ledger',
        heading: '2. Append-Only Financial Ledger',
        content: [
          'Every balance change is recorded in an immutable, append-only PostgreSQL ledger (ledger_entries). User balances are derived mathematically as SUM(amount) for that user and currency.',
          'Balance mutations are serialized with transactional advisory locks, and the database strictly prohibits any transaction that would result in a negative balance.',
        ],
      },
      {
        id: 'current-status',
        heading: '3. Current Operating Status',
        content: [
          'Real-money payment provider integration (Stripe, card acquiring) and withdrawal cash-out execution are currently in active architectural design and regulatory review.',
          'During the development phase, Diamond shop purchases operate in Sandbox/Test Mode. No real money is currently charged, and cash-outs are not yet operational.',
        ],
      },
    ],
    relatedSlugs: ['withdrawals', 'refunds', 'rules', 'terms'],
  },

  withdrawals: {
    type: 'WITHDRAWALS',
    slug: 'withdrawals',
    title: 'Cash-Out & Withdrawal Policy',
    subtitle: 'Rules, eligibility criteria, and redemption procedures for Diamond cash-outs.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.WITHDRAWALS,
    summary:
      'This policy outlines the future lifecycle and rules for converting eligible Diamond winnings into real-money payouts. Cash-out features are currently in pre-launch design.',
    sections: [
      {
        id: 'withdrawal-lifecycle',
        heading: '1. Withdrawal Lifecycle & Reservation',
        content: [
          'When cash-out functionality is enabled, the withdrawal process will follow a secure multi-step lifecycle:',
          '1. Request: The player requests a cash-out of eligible Diamonds.',
          '2. Atomic Reservation: The requested Diamond amount is immediately debited into withdrawal escrow, preventing concurrent wagering or double-spending.',
          '3. Compliance & Risk Review: Verification of identity, fair-play audit, and AML playthrough checks.',
          '4. Payout Dispatch: Real-money funds are transmitted to the player via our approved payout gateway.',
        ],
      },
      {
        id: 'eligibility-and-aml',
        heading: '2. Eligibility & Anti-Money Laundering (AML)',
        content: [
          'To prevent financial fraud and credit card laundering, Diamond balances must meet standard playthrough criteria before withdrawal.',
          'Won Diamonds from verified matches are 100% cash-out eligible upon completing identity verification. Unwagered deposit balances are subject to original payment method refund rules.',
        ],
      },
      {
        id: 'status-notice',
        heading: '3. Feature Availability Notice',
        content: [
          'Withdrawal functionality is not currently live. Real-money payment gateway integration is pending final regulatory classification. Payout limits, processing times, and supported payout methods will be published upon launch.',
        ],
      },
    ],
    relatedSlugs: ['diamonds', 'refunds', 'eligibility', 'disputes'],
  },

  refunds: {
    type: 'REFUNDS',
    slug: 'refunds',
    title: 'Refund Policy',
    subtitle: 'Rules governing match entry refunds, technical voids, and transaction disputes.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.REFUNDS,
    summary:
      'Fugluck provides automatic, database-enforced refunds for match draws, disconnects, and server interruptions. Learn how match refunds and purchase refund requests are handled.',
    sections: [
      {
        id: 'match-refunds',
        heading: '1. Match Entry Refunds (Automatic)',
        content: [
          'The Fugluck ledger engine automatically issues 100% stake refunds in the following scenarios:',
          '• Match Draws: Both players receive a full refund of their staked entry amounts when verified scores tie.',
          '• Technical Interruptions & Crashes: If a server restart or network drop interrupts an active match, our orphan recovery engine voids the match and refunds both participants.',
          '• Opponent No-Show / Queue Timeout: If an opponent disconnects during queueing or pre-game synchronization, your entry stake is immediately returned.',
        ],
      },
      {
        id: 'completed-matches',
        heading: '2. Legitimate Completed Matches',
        content: [
          'Once a match is completed with verified server-side scores, the outcome is final. Staked entries in legitimately resolved matches cannot be refunded due to player dissatisfaction or loss of skill competition.',
        ],
      },
      {
        id: 'purchase-refunds',
        heading: '3. Diamond Purchase Refunds',
        content: [
          'Once real-money payment processors are operational, requests for refunds of unplayed Diamond packages will be processed through customer support in accordance with consumer protection regulations and payment processor guidelines.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'rules', 'diamonds', 'withdrawals'],
  },

  'responsible-play': {
    type: 'RESPONSIBLE_PLAY',
    slug: 'responsible-play',
    title: 'Responsible Play Policy',
    subtitle: 'Our commitment to healthy gaming habits, spending awareness, and player well-being.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.RESPONSIBLE_PLAY,
    summary:
      'Fugluck is dedicated to providing a safe, enjoyable, and balanced gaming environment. We encourage all players to compete responsibly and maintain healthy boundaries.',
    sections: [
      {
        id: 'principles',
        heading: '1. Principles of Responsible Play',
        content: [
          '• Play for Entertainment: Competitive gaming should be an enjoyable test of skill, reflex, and strategy.',
          '• Never Chase Losses: Avoid wagering larger amounts or extending session times to recover previous losses.',
          '• Set Personal Limits: Establish clear time and budget boundaries before entering competitive arenas.',
          '• Balance with Life: Gaming should complement, not replace, daily responsibilities, work, or social connections.',
        ],
      },
      {
        id: 'player-controls',
        heading: '2. Available Account Controls',
        content: [
          'Fugluck provides tools to help manage your platform engagement:',
          '• Free Practice & Free Play: You can always play offline Practice Mode or zero-stake guest matches without financial commitments.',
          '• Account Pause & Cool-Off: You can request temporary account suspension or self-exclusion through our support desk.',
          '• Account Closure: You may permanently close your account at any time.',
        ],
      },
      {
        id: 'seeking-help',
        heading: '3. Recognizing Unhealthy Habits',
        content: [
          'If gaming begins to cause stress, financial strain, or emotional distress, we strongly encourage reaching out to professional support organizations and taking an extended break from competitive play.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'eligibility', 'data-rights', 'fair-play'],
  },

  eligibility: {
    type: 'ELIGIBILITY',
    slug: 'eligibility',
    title: 'Eligibility & Jurisdictional Restrictions',
    subtitle: 'Age requirements, geographic access rules, and regulatory compliance standards.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.ELIGIBILITY,
    summary:
      'Fugluck complies with applicable legal, age, and jurisdictional standards for skill-based gaming. Learn about player eligibility requirements and geographical restrictions.',
    sections: [
      {
        id: 'age-requirements',
        heading: '1. Age Requirements',
        content: [
          'You must be of legal age to form a binding contract and participate in skill-based competitions in your jurisdiction. The minimum age for account registration and participation is subject to local regulatory confirmation.',
        ],
      },
      {
        id: 'jurisdiction-rules',
        heading: '2. Geographical & Jurisdictional Availability',
        content: [
          'Skill-based gaming laws vary by country, state, and province. It is the responsibility of each player to ensure that accessing Fugluck and participating in competitive matches is lawful in their location.',
          'Fugluck reserves the right to restrict access from sanctioned regions, jurisdictions where skill gaming is restricted, or locations where regulatory licensing is required.',
        ],
      },
      {
        id: 'identity-verification',
        heading: '3. Identity Verification (KYC)',
        content: [
          'Prior to processing real-money transactions or cash-out requests, Fugluck may require identity verification (including proof of identity and address) to comply with anti-fraud and anti-money laundering requirements.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'responsible-play', 'withdrawals', 'fair-play'],
  },

  'fair-play': {
    type: 'FAIR_PLAY',
    slug: 'fair-play',
    title: 'Fair Play & Anti-Cheating Policy',
    subtitle: 'Our rigorous standards and technological safeguards to guarantee competitive integrity.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.FAIR_PLAY,
    summary:
      'Cheating, botting, score manipulation, and unfair tactics are strictly prohibited on Fugluck. Our server-authoritative simulation engine detects and rejects modified runs automatically.',
    sections: [
      {
        id: 'prohibited-tools',
        heading: '1. Prohibited Tools & Behaviors',
        content: [
          'The following activities constitute severe fair-play violations:',
          '• Automated Input Tools & Bots: Utilizing macros, auto-clickers, artificial intelligence agents, or automated input replay scripts.',
          '• Client Modification & Injection: Modifying the client JavaScript bundle, injecting memory modifications, or manipulating fixed-timestep loops.',
          '• Speedhacking & Freeze-Frame Exploits: Artificially slowing down clock timings or creating browser freeze-frames to gain artificial reaction time.',
          '• Collusion & Rating Abuse: Match fixing, intentionally forfeiting to transfer balances, or queueing against puppet accounts.',
        ],
      },
      {
        id: 'detection-systems',
        heading: '2. Anti-Cheat & Verification Technology',
        content: [
          '• Headless Server Simulation: The server runs the identical deterministic game engine against the match seed and client input log to re-derive the authoritative score.',
          '• Freeze-Frame Auto-Forfeit: Submissions where real-world duration exceeds simulated tick progress by more than 3.0 seconds are automatically rejected as freeze-frame cheating.',
          '• Anomaly Detection: Impossible input frequencies, superhuman reaction speeds, and inconsistent coordinate jumps are automatically flagged for review.',
        ],
      },
      {
        id: 'penalties',
        heading: '3. Consequences of Violations',
        content: [
          'Confirmed violations result in immediate match forfeit, nullification of leaderboard positions, balance forfeiture, and permanent account ban.',
        ],
      },
    ],
    relatedSlugs: ['rules', 'terms', 'security', 'disputes'],
  },

  disputes: {
    type: 'DISPUTES',
    slug: 'disputes',
    title: 'Complaints & Disputes Policy',
    subtitle: 'Our formal procedure for reviewing match issues, balance inquiries, and player complaints.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.DISPUTES,
    summary:
      'We provide a structured, transparent process for investigating match disputes, ledger discrepancies, and account moderation appeals.',
    sections: [
      {
        id: 'dispute-categories',
        heading: '1. Types of Inquiries & Disputes',
        content: [
          'Players may submit dispute inquiries regarding:',
          '• Match Result Inquiries: Suspected opponent cheating, abnormal disconnects, or score verification disputes.',
          '• Ledger & Balance Discrepancies: Inquiries regarding escrow debits, victory payouts, or missing grants.',
          '• Account Moderation Appeals: Review requests for suspended or restricted accounts.',
        ],
      },
      {
        id: 'resolution-process',
        heading: '2. Investigation & Resolution Procedure',
        content: [
          '1. Submission: Submit an inquiry via our Help Center (/help) or Contact page (/contact) with match ID, timestamps, and details.',
          '2. Ledger & Simulation Audit: An administrator reviews the match seed, input logs, and database ledger audit records.',
          '3. Resolution: Findings are communicated to the player. If an error is verified, compensating ledger adjustments are made.',
        ],
      },
    ],
    relatedSlugs: ['terms', 'fair-play', 'refunds', 'contact'],
  },

  'data-rights': {
    type: 'DATA_RIGHTS',
    slug: 'data-rights',
    title: 'Data Rights & Account Closure',
    subtitle: 'How to request your personal data, update information, or request account closure.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.DATA_RIGHTS,
    summary:
      'Understand your rights regarding data access, portability, correction, and account closure. Learn how financial and anti-cheat records are retained under regulatory obligations.',
    sections: [
      {
        id: 'available-rights',
        heading: '1. Your Personal Data Rights',
        content: [
          'Under applicable data protection frameworks, you have the right to:',
          '• Access & Export: Request an electronic copy of your profile data, match history, and ledger records.',
          '• Correction: Request correction of inaccurate profile or account information.',
          '• Account Closure: Request permanent closure of your Fugluck account.',
        ],
      },
      {
        id: 'retention-exceptions',
        heading: '2. Financial & Security Retention Exceptions',
        content: [
          'When an account is closed, your login credentials are deleted and personal identifiers removed.',
          'However, append-only financial ledger entries (ledger_entries) and match settlement records (match_settlements) must be retained in an anonymized format to preserve platform financial balance integrity, audit trails, and anti-money laundering compliance.',
        ],
      },
      {
        id: 'how-to-submit',
        heading: '3. Submitting a Data Request',
        content: [
          'To submit a data request or request account closure, please submit an inquiry through our Contact page (/contact) from your registered email address.',
        ],
      },
    ],
    relatedSlugs: ['privacy', 'terms', 'security', 'contact'],
  },

  security: {
    type: 'SECURITY',
    slug: 'security',
    title: 'Platform Security Information',
    subtitle: 'Technical safeguards, encryption standards, and architectural security controls.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.SECURITY,
    summary:
      'Fugluck is engineered with enterprise security controls: salted password hashing, HTTP-only session cookies, PostgreSQL advisory transaction locks, and server-side rate limiters.',
    sections: [
      {
        id: 'authentication-security',
        heading: '1. Authentication & Session Protection',
        content: [
          '• Passwords: Salted and hashed using strong cryptographic algorithms (Argon2id / bcrypt). Plaintext passwords are never stored or logged.',
          '• Sessions: Authenticated sessions use HTTP-only, SameSite=Lax cookies with Secure flags in production environments.',
          '• Brute-Force & Lockout Protection: Server-side rate limiters restrict repeated login and registration attempts, with automatic IP-based lockouts for repeated administrative failures.',
        ],
      },
      {
        id: 'financial-architecture',
        heading: '2. Financial & Ledger Safeguards',
        content: [
          '• Non-Negative Balance Trigger: PostgreSQL trigger ledger_non_negative_guard guarantees balances cannot be overdrawn at the storage engine layer.',
          '• Advisory Transaction Locks: Dual-user advisory locks prevent race conditions across concurrent matchmaking and wallet operations.',
          '• Single-Settlement Integrity: Primary key constraints ensure every match settles exactly once.',
        ],
      },
      {
        id: 'responsible-disclosure',
        heading: '3. Responsible Vulnerability Disclosure',
        content: [
          'If you discover a security vulnerability or bug, please report it privately through our Contact page (/contact). We investigate all reports promptly.',
        ],
      },
    ],
    relatedSlugs: ['privacy', 'terms', 'fair-play', 'data-rights'],
  },

  about: {
    type: 'ABOUT',
    slug: 'about',
    title: 'About Fugluck',
    subtitle: 'The modern competitive skill-arcade platform where true player skill decides the victory.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.ABOUT,
    summary:
      'Fugluck is an online skill-based gaming arena built for quick, intense head-to-head arcade battles. Every match is 100% server-authoritative, deterministic, and fair.',
    sections: [
      {
        id: 'our-mission',
        heading: '1. Our Mission',
        content: [
          'Fugluck was built on a simple premise: competitive gaming should reward skill, speed, and precision—without pay-to-win mechanics or hidden algorithms.',
          'Whether you are dodging obstacles in Neon Runner, testing lightning reflexes in Pixel Ninja Dash, clearing waves in Space Blaster, or answering fast in Speed Trivia Clash, you compete against real players under perfectly identical conditions.',
        ],
      },
      {
        id: 'fairness-first',
        heading: '2. Fairness by Design',
        content: [
          'We built our platform from the ground up with a fixed 60 FPS deterministic physics loop, identical random seeds, and headless server anti-cheat simulation. No pay-to-win boosts. No lucky crits. Just player skill.',
        ],
      },
      {
        id: 'game-modes',
        heading: '3. Play Your Way',
        content: [
          '• Offline Practice: Hone your skills with zero stakes.',
          '• Instant Free Play: Share an invite link with friends for casual fun.',
          '• Coin Matches: Enjoy competitive multiplayer using our free virtual currency.',
          '• Diamond Matches: Compete in high-stakes arenas with real prize potential.',
        ],
      },
    ],
    relatedSlugs: ['rules', 'fair-play', 'diamonds', 'contact'],
  },

  contact: {
    type: 'CONTACT',
    slug: 'contact',
    title: 'Contact & Support',
    subtitle: 'Get in touch with the Fugluck team for player support, inquiries, or feedback.',
    lastUpdated: 'August 18, 2026',
    version: CURRENT_POLICY_VERSIONS.CONTACT,
    summary:
      'Have a question about a match, your account, or platform rules? Our support team is here to help. Explore our Help Center or reach out directly.',
    sections: [
      {
        id: 'support-channels',
        heading: '1. Support & Communication Channels',
        content: [
          '• Help Center: Browse our comprehensive FAQ and troubleshooting guides at /help for instant answers to common questions.',
          '• Account & Match Inquiries: Submit match IDs and detailed logs to our support desk for fast resolution.',
          '• Legal & Compliance: For formal policy, regulatory, or privacy inquiries, contact our compliance team.',
        ],
      },
      {
        id: 'response-expectations',
        heading: '2. Response Times & Operating Hours',
        content: [
          'Our support desk reviews inquiries in the order received. For fastest assistance with match-related questions, always include the match ID, game title, and relevant timestamps.',
        ],
      },
    ],
    relatedSlugs: ['about', 'disputes', 'terms', 'privacy'],
  },
}
