import { useEffect, useRef, useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '../i18n'
import { LanguageFlag } from './FlagIcons'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const currentLang = (i18n.language || 'en').slice(0, 2) as SupportedLanguageCode
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listboxId = useId()

  const currentOption = SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLang) || SUPPORTED_LANGUAGES[0]

  function handleLanguageChange(code: SupportedLanguageCode) {
    void i18n.changeLanguage(code)
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  // Handle outside clicks to close dropdown
  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen])

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
        const currentIndex = SUPPORTED_LANGUAGES.findIndex((lang) => lang.code === currentLang)
        setFocusedIndex(currentIndex >= 0 ? currentIndex : 0)
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        buttonRef.current?.focus()
        break
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((prev) => (prev + 1) % SUPPORTED_LANGUAGES.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((prev) => (prev - 1 + SUPPORTED_LANGUAGES.length) % SUPPORTED_LANGUAGES.length)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < SUPPORTED_LANGUAGES.length) {
          handleLanguageChange(SUPPORTED_LANGUAGES[focusedIndex].code)
        }
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev)
          if (!isOpen) {
            const currentIndex = SUPPORTED_LANGUAGES.findIndex((lang) => lang.code === currentLang)
            setFocusedIndex(currentIndex >= 0 ? currentIndex : 0)
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={t('navigation.selectLanguage', { defaultValue: 'Select language' })}
        title={currentOption.label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '32px',
          padding: '0 8px',
          background: isOpen ? 'var(--color-surface-raised, #1a1a23)' : 'rgba(255, 255, 255, 0.04)',
          border: isOpen ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
          borderRadius: 'var(--radius-full, 9999px)',
          color: 'var(--color-text)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          boxShadow: isOpen ? 'var(--glow-primary, 0 0 0 2px rgba(124, 58, 237, 0.35))' : 'none',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'var(--color-primary-hover, #8b5cf6)'
            e.currentTarget.style.background = 'var(--color-surface-raised, #1a1a23)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'var(--color-border)'
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
          }
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = 'var(--focus-ring, 0 0 0 3px rgba(124, 58, 237, 0.45))'
        }}
        onBlur={(e) => {
          if (!isOpen) {
            e.currentTarget.style.boxShadow = 'none'
          }
        }}
      >
        <LanguageFlag code={currentLang} width={18} height={12} />
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--color-text-muted)',
          }}
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <ul
          id={listboxId}
          ref={menuRef}
          role="listbox"
          aria-label={t('navigation.selectLanguage', { defaultValue: 'Select language' })}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            margin: 0,
            padding: '4px',
            listStyle: 'none',
            minWidth: '150px',
            background: 'var(--color-surface, #121218)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md, 12px)',
            boxShadow: 'var(--shadow-elevate, 0 8px 30px rgba(0, 0, 0, 0.45))',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang, index) => {
            const isSelected = currentLang === lang.code
            const isFocused = focusedIndex === index

            return (
              <li
                key={lang.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleLanguageChange(lang.code)}
                onMouseEnter={() => setFocusedIndex(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs, 12px)',
                  fontWeight: isSelected ? 'var(--font-weight-bold, 700)' : 'var(--font-weight-medium, 500)',
                  color: isSelected ? '#ffffff' : 'var(--color-text)',
                  background: isSelected
                    ? 'var(--color-primary, #7c3aed)'
                    : isFocused
                    ? 'var(--color-surface-raised, #1a1a23)'
                    : 'transparent',
                  transition: 'background 0.12s ease, color 0.12s ease',
                  userSelect: 'none',
                }}
              >
                <LanguageFlag code={lang.code} width={18} height={12} />
                <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{lang.label}</span>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M20 6L9 17L4 12"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
