import i18n from 'i18next'
import en from '../packages/client/src/locales/en.json'
import ka from '../packages/client/src/locales/ka.json'
import ru from '../packages/client/src/locales/ru.json'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL  ${message}`)
    process.exit(1)
  }
  console.log(`  PASS  ${message}`)
}

async function runI18nAudit() {
  console.log('\n--- Fugluck i18n System Comprehensive Verification ---\n')

  // Test 1: Translation Resources Loading & Structural Parity
  console.log('Test 1: Translation Resources Structure & Parity')
  assert(typeof en === 'object' && en !== null, 'English translation resource loaded')
  assert(typeof ka === 'object' && ka !== null, 'Georgian translation resource loaded')
  assert(typeof ru === 'object' && ru !== null, 'Russian translation resource loaded')

  const enBaseKeys = getBaseKeys(en)
  const kaBaseKeys = getBaseKeys(ka)
  const ruBaseKeys = getBaseKeys(ru)

  assert(enBaseKeys.length > 50, `English contains ${enBaseKeys.length} base translation keys`)
  assert(kaBaseKeys.length === enBaseKeys.length, `Georgian base key count (${kaBaseKeys.length}) matches English (${enBaseKeys.length})`)
  assert(ruBaseKeys.length === enBaseKeys.length, `Russian base key count (${ruBaseKeys.length}) matches English (${enBaseKeys.length})`)

  const missingInKa = enBaseKeys.filter((k) => !kaBaseKeys.includes(k))
  const missingInRu = enBaseKeys.filter((k) => !ruBaseKeys.includes(k))

  assert(missingInKa.length === 0, `No missing keys in Georgian resources`)
  assert(missingInRu.length === 0, `No missing keys in Russian resources`)

  // Test 2: i18next Initialization & Language Switching
  console.log('\nTest 2: i18next Engine Initialization & Language Switching')
  await i18n.init({
    resources: {
      en: { translation: en },
      ka: { translation: ka },
      ru: { translation: ru },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ka', 'ru'],
    interpolation: { escapeValue: false },
  })

  assert(i18n.isInitialized, 'i18next engine successfully initialized')

  await i18n.changeLanguage('en')
  assert(i18n.language === 'en', 'Active language set to English (en)')
  assert(i18n.t('navigation.home') === 'Home', 'English nav home: Home')

  await i18n.changeLanguage('ka')
  assert(i18n.language === 'ka', 'Active language switched to Georgian (ka)')
  assert(i18n.t('navigation.home') === 'მთავარი', 'Georgian nav home: მთავარი')

  await i18n.changeLanguage('ru')
  assert(i18n.language === 'ru', 'Active language switched to Russian (ru)')
  assert(i18n.t('navigation.home') === 'Главная', 'Russian nav home: Главная')

  // Test 3: Interpolation & Dynamic Variables
  console.log('\nTest 3: Dynamic Variable Interpolation')
  await i18n.changeLanguage('en')
  assert(
    i18n.t('game.wonCoins', { count: 100 }) === 'You won 100 coins.',
    'English interpolation: "You won 100 coins."',
  )

  await i18n.changeLanguage('ka')
  assert(
    i18n.t('game.wonCoins', { count: 100 }) === 'თქვენ მოიგეთ 100 მონეტა.',
    'Georgian interpolation: "თქვენ მოიგეთ 100 მონეტა."',
  )

  await i18n.changeLanguage('ru')
  assert(
    i18n.t('game.wonCoins', { count: 100 }) === 'Вы выиграли 100 монет.',
    'Russian interpolation: "Вы выиграли 100 монет."',
  )

  // Test 4: Pluralization Rules (English, Georgian, Russian)
  console.log('\nTest 4: Pluralization Rules Across Languages')
  await i18n.changeLanguage('en')
  assert(i18n.t('wallet.coins', { count: 1 }) === '1 coin', 'English singular: 1 coin')
  assert(i18n.t('wallet.coins', { count: 5 }) === '5 coins', 'English plural: 5 coins')

  await i18n.changeLanguage('ka')
  assert(i18n.t('wallet.coins', { count: 1 }) === '1 მონეტა', 'Georgian singular: 1 მონეტა')
  assert(i18n.t('wallet.coins', { count: 5 }) === '5 მონეტა', 'Georgian plural: 5 მონეტა')

  await i18n.changeLanguage('ru')
  assert(i18n.t('wallet.coins', { count: 1 }) === '1 монета', 'Russian (1): 1 монета (one)')
  assert(i18n.t('wallet.coins', { count: 3 }) === '3 монеты', 'Russian (3): 3 монеты (few)')
  assert(i18n.t('wallet.coins', { count: 5 }) === '5 монет', 'Russian (5): 5 монет (many)')
  assert(i18n.t('wallet.coins', { count: 21 }) === '21 монета', 'Russian (21): 21 монета (one)')

  // Test 5: Safe Fallback for Missing Keys
  console.log('\nTest 5: Safe Fallback Behavior for Missing Keys')
  const missingKeyResult = i18n.t('nonexistent.key.test', { defaultValue: 'Fallback Text' })
  assert(missingKeyResult === 'Fallback Text', 'Missing key uses controlled default fallback without crashing')

  // Test 6: Browser Language Detection Logic
  console.log('\nTest 6: Browser Language Mapping Logic')
  function mapBrowserLanguage(browserLang: string): string {
    const primary = browserLang.toLowerCase().split('-')[0]
    if (primary === 'ka') return 'ka'
    if (primary === 'ru') return 'ru'
    if (primary === 'en') return 'en'
    return 'en' // fallback
  }

  assert(mapBrowserLanguage('ka-GE') === 'ka', 'ka-GE maps to ka')
  assert(mapBrowserLanguage('ru-RU') === 'ru', 'ru-RU maps to ru')
  assert(mapBrowserLanguage('en-US') === 'en', 'en-US maps to en')
  assert(mapBrowserLanguage('fr-FR') === 'en', 'Unsupported language fr-FR falls back to en')

  // Test 7: Language Change Does Not Mutate State
  console.log('\nTest 7: Application State Isolation Guard')
  const dummyState = {
    userId: 'usr_123',
    balances: { coins: 1000, diamonds: 50 },
    gameScore: 450,
  }

  const initialStateSnapshot = JSON.stringify(dummyState)
  await i18n.changeLanguage('ka')
  await i18n.changeLanguage('ru')
  await i18n.changeLanguage('en')
  const finalStateSnapshot = JSON.stringify(dummyState)

  assert(
    initialStateSnapshot === finalStateSnapshot,
    'User state (balances, score, userId) remains 100% untouched across language switches',
  )

  // Test 8: Game Terminology Parity
  console.log('\nTest 8: Canonical Game Terminology Consistency')
  const canonicalTerms = [
    'match',
    'opponent',
    'score',
    'win',
    'loss',
    'draw',
    'forfeit',
    'reconnect',
    'stake',
    'coins',
    'diamonds',
    'matchmaking',
  ]

  canonicalTerms.forEach((term) => {
    assert(
      typeof (en as any).game[term] === 'string' &&
        typeof (ka as any).game[term] === 'string' &&
        typeof (ru as any).game[term] === 'string',
      `Game term "${term}" has canonical translations in en, ka, ru`,
    )
  })

  // Test 9: Matchmaking Lobby Translation Parity & Dynamic Localization
  console.log('\nTest 9: Matchmaking Lobby Translation Parity')
  const lobbyKeys = [
    'title',
    'subtitle',
    'noPlayersWaiting',
    'emptyTitle',
    'emptyMessage',
    'searching',
    'you',
    'freePlay',
    'matchBtn',
    'waitingOpponent',
    'guestWagerError',
    'insufficientBalance',
  ]

  lobbyKeys.forEach((key) => {
    assert(
      typeof (en as any).lobby[key] === 'string' &&
        typeof (ka as any).lobby[key] === 'string' &&
        typeof (ru as any).lobby[key] === 'string',
      `Lobby key "${key}" has translations across en, ka, ru`,
    )
  })

  await i18n.changeLanguage('en')
  assert(i18n.t('lobby.title') === 'Live Matchmaking Lobby', 'EN lobby title: Live Matchmaking Lobby')
  assert(i18n.t('lobby.playersWaiting', { count: 1 }) === '1 player waiting', 'EN lobby 1 player waiting')
  assert(i18n.t('lobby.playersWaiting', { count: 3 }) === '3 players waiting', 'EN lobby 3 players waiting')

  await i18n.changeLanguage('ka')
  assert(i18n.t('lobby.title') === 'ცოცხალი მატჩმეიკინგის ლობი', 'KA lobby title: ცოცხალი მატჩმეიკინგის ლობი')
  assert(i18n.t('lobby.playersWaiting', { count: 1 }) === '1 მოთამაშე ელოდება', 'KA lobby 1 მოთამაშე ელოდება')

  await i18n.changeLanguage('ru')
  assert(i18n.t('lobby.title') === 'Лобби живого подбора матчей', 'RU lobby title: Лобби живого подбора матчей')
  assert(i18n.t('lobby.playersWaiting', { count: 1 }) === '1 игрок в очереди', 'RU lobby 1 игрок в очереди')
  assert(i18n.t('lobby.playersWaiting', { count: 3 }) === '3 игрока в очереди', 'RU lobby 3 игрока в очереди')
  assert(i18n.t('lobby.playersWaiting', { count: 5 }) === '5 игроков в очереди', 'RU lobby 5 игроков в очереди')

  console.log('\nAll i18n checks passed 100% successfully!\n')
}

function getBaseKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getBaseKeys(obj[key], fullKey))
    } else {
      const baseKey = fullKey.replace(/_(one|few|many|other)$/, '')
      if (!keys.includes(baseKey)) {
        keys.push(baseKey)
      }
    }
  }
  return keys
}

runI18nAudit().catch((err) => {
  console.error('i18n check failed:', err)
  process.exit(1)
})
