import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'

type LaunchModalProps = {
  gameTitle: string
  onClose: () => void
  onLaunchPractice: () => void
  onLaunchInviteLink: () => void
  onLaunchCoinsMatch?: (stake: number) => void
  onLaunchDiamondsMatch?: (stake: number) => void
}

const COIN_STAKE_OPTIONS = [25, 50, 100, 250, 500]
const DIAMOND_STAKE_OPTIONS = [5, 10, 25, 50, 100]

export default function LaunchModal({
  gameTitle,
  onClose,
  onLaunchPractice,
  onLaunchInviteLink,
  onLaunchCoinsMatch,
  onLaunchDiamondsMatch,
}: LaunchModalProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [stakeCurrency, setStakeCurrency] = useState<'COINS' | 'DIAMONDS' | null>(null)
  const [selectedStake, setSelectedStake] = useState<number>(100)
  const [customInput, setCustomInput] = useState<string>('')

  const currentBalance = stakeCurrency === 'COINS' ? (user?.balances.coins ?? 0) : (user?.balances.diamonds ?? 0)
  const stakeOptions = stakeCurrency === 'COINS' ? COIN_STAKE_OPTIONS : DIAMOND_STAKE_OPTIONS

  const parsedCustom = customInput ? parseInt(customInput, 10) : NaN
  const isCustomExceeding = !isNaN(parsedCustom) && parsedCustom > currentBalance
  const canSubmit = selectedStake > 0 && selectedStake <= currentBalance && !isCustomExceeding

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="ac-panel"
        style={{
          width: '90%',
          maxWidth: 440,
          padding: 'var(--space-6)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>
            {stakeCurrency
              ? t('game.selectStake', { currency: stakeCurrency })
              : t('game.launchTitle', { title: gameTitle })}
          </h2>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={onClose}
            style={{ padding: 'var(--space-1) var(--space-2)' }}
          >
            ✕
          </button>
        </div>

        {stakeCurrency ? (
          /* Stake Selection Step */
          <div>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
              {t('game.choosePresetOrCustom', { title: gameTitle })}
            </p>

            <div
              style={{
                background: 'var(--color-surface-raised, #1e293b)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                {t('game.availableBalance')}
              </span>
              <strong style={{ color: stakeCurrency === 'COINS' ? '#fbbf24' : '#a855f7' }}>
                {currentBalance} {stakeCurrency}
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              {stakeOptions.map((amount) => {
                const canAfford = currentBalance >= amount
                const isSelected = selectedStake === amount && !customInput

                return (
                  <button
                    key={amount}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => {
                      setCustomInput('')
                      setSelectedStake(amount)
                    }}
                    className={`ac-btn ${isSelected ? 'ac-btn--primary' : 'ac-btn--ghost'}`}
                    style={{
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: 'var(--space-3)',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      opacity: canAfford ? 1 : 0.4,
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <span>
                      {amount} {stakeCurrency === 'COINS' ? '🪙' : '💎'}
                    </span>
                    {!canAfford && <span style={{ fontSize: '9px', color: '#f87171' }}>{t('game.tooLow')}</span>}
                  </button>
                )
              })}
            </div>

            {/* Custom Amount Input Field */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', display: 'block', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                {t('game.customWager', { currency: stakeCurrency })}
              </label>
              <input
                type="number"
                min={1}
                max={currentBalance}
                placeholder={t('game.customPlaceholder')}
                value={customInput}
                onChange={(e) => {
                  const val = e.target.value
                  setCustomInput(val)
                  const num = parseInt(val, 10)
                  if (!isNaN(num) && num > 0) {
                    setSelectedStake(num)
                  }
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)',
                  border: isCustomExceeding ? '1px solid #f87171' : '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
              {isCustomExceeding && (
                <span style={{ fontSize: '11px', color: '#f87171', display: 'block', marginTop: 4 }}>
                  {t('game.customExceedsBalance', { balance: currentBalance, currency: stakeCurrency })}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={() => {
                  setStakeCurrency(null)
                  setCustomInput('')
                }}
                style={{ flex: 1 }}
              >
                ← {t('common.back')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn--primary"
                disabled={!canSubmit}
                onClick={() => {
                  if (!canSubmit) return
                  if (stakeCurrency === 'COINS') onLaunchCoinsMatch?.(selectedStake)
                  else onLaunchDiamondsMatch?.(selectedStake)
                  onClose()
                }}
                style={{ flex: 2, fontWeight: 'bold', opacity: canSubmit ? 1 : 0.4 }}
              >
                {t('game.enterQueue', { stake: selectedStake, currency: stakeCurrency })}
              </button>
            </div>
          </div>
        ) : (
          /* Mode Selection Step */
          <>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
              {user
                ? t('game.matchmaking')
                : t('game.guestWagerNotice')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Mode 1: Solo Rush */}
              <button
                type="button"
                className="ac-btn ac-btn--secondary"
                onClick={() => {
                  onLaunchPractice()
                  onClose()
                }}
                style={{ width: '100%', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
              >
                🕹️ <strong style={{ marginLeft: 8 }}>{t('game.soloRush')}</strong> — {t('game.practiceMode')}
              </button>

              {/* Mode 2: Instant Invite Link */}
              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={() => {
                  onLaunchInviteLink()
                  onClose()
                }}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: 'var(--space-3)',
                  border: '1px dashed var(--color-border)',
                }}
              >
                🔗 <strong style={{ marginLeft: 8 }}>{t('game.instantInviteLink')}</strong> — {t('game.shareFreePlay')}
              </button>

              {/* Mode 3 & 4: Only for Authenticated Users */}
              {user ? (
                <>
                  <button
                    type="button"
                    className="ac-btn ac-btn--secondary"
                    onClick={() => {
                      onLaunchCoinsMatch?.(0)
                      onClose()
                    }}
                    style={{ width: '100%', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                  >
                    ⚡ <strong style={{ marginLeft: 8 }}>Free Match</strong> — Public Queue (0 stake)
                  </button>

                  <button
                    type="button"
                    className="ac-btn ac-btn--primary"
                    onClick={() => {
                      setStakeCurrency('COINS')
                      setSelectedStake(100)
                      setCustomInput('')
                    }}
                    style={{ width: '100%', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                  >
                    🪙 <strong style={{ marginLeft: 8 }}>{t('game.playWithCoins')}</strong> — {t('game.funMatchRake')}
                  </button>

                  <button
                    type="button"
                    className="ac-btn"
                    onClick={() => {
                      setStakeCurrency('DIAMONDS')
                      setSelectedStake(10)
                      setCustomInput('')
                    }}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: 'var(--space-3)',
                      background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    💎 <strong style={{ marginLeft: 8 }}>{t('game.playWithDiamonds')}</strong> — {t('game.competitiveRake')}
                  </button>
                </>
              ) : (
                <div
                  style={{
                    marginTop: 'var(--space-2)',
                    padding: 'var(--space-3)',
                    background: 'var(--color-surface-raised, #1e293b)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  🔒 {t('game.guestWagerNotice')}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
