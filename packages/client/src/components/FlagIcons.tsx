import type { SupportedLanguageCode } from '../i18n'

type FlagProps = {
  width?: number
  height?: number
  className?: string
}

export function FlagGB({ width = 20, height = 14, className }: FlagProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 40"
      fill="none"
      className={className}
      style={{
        borderRadius: 2,
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.15)',
      }}
      aria-hidden="true"
    >
      <clipPath id="fugluck-flag-gb-clip">
        <rect width="60" height="40" rx="2" />
      </clipPath>
      <g clipPath="url(#fugluck-flag-gb-clip)">
        <path d="M0 0h60v40H0z" fill="#012169" />
        <path d="M0 0l60 40m0-40L0 40" stroke="#ffffff" strokeWidth="7" />
        <path d="M0 0l60 40m0-40L0 40" stroke="#C8102E" strokeWidth="4" />
        <path d="M30 0v40M0 20h60" stroke="#ffffff" strokeWidth="11" />
        <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="6.5" />
      </g>
    </svg>
  )
}

export function FlagGE({ width = 20, height = 14, className }: FlagProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 30 20"
      fill="none"
      className={className}
      style={{
        borderRadius: 2,
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.15)',
      }}
      aria-hidden="true"
    >
      <clipPath id="fugluck-flag-ge-clip">
        <rect width="30" height="20" rx="2" />
      </clipPath>
      <g clipPath="url(#fugluck-flag-ge-clip)">
        <rect width="30" height="20" fill="#ffffff" />
        <path d="M12 0h6v20h-6zM0 7h30v6H0z" fill="#EE1C25" />
        {/* 4 Bolnisi crosses in the 4 quadrants */}
        <g fill="#EE1C25">
          {/* Top-left cross */}
          <path d="M5.1 2.3h1.8v3.4H5.1zM4.3 3.1h3.4v1.8H4.3z" />
          {/* Top-right cross */}
          <path d="M23.1 2.3h1.8v3.4h-1.8zM22.3 3.1h3.4v1.8h-3.4z" />
          {/* Bottom-left cross */}
          <path d="M5.1 14.3h1.8v3.4H5.1zM4.3 15.1h3.4v1.8H4.3z" />
          {/* Bottom-right cross */}
          <path d="M23.1 14.3h1.8v3.4h-1.8zM22.3 15.1h3.4v1.8h-3.4z" />
        </g>
      </g>
    </svg>
  )
}

export function FlagRU({ width = 20, height = 14, className }: FlagProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 30 20"
      fill="none"
      className={className}
      style={{
        borderRadius: 2,
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.15)',
      }}
      aria-hidden="true"
    >
      <clipPath id="fugluck-flag-ru-clip">
        <rect width="30" height="20" rx="2" />
      </clipPath>
      <g clipPath="url(#fugluck-flag-ru-clip)">
        <rect width="30" height="20" fill="#ffffff" />
        <rect y="6.67" width="30" height="6.67" fill="#0039A6" />
        <rect y="13.33" width="30" height="6.67" fill="#D52B1E" />
      </g>
    </svg>
  )
}

export function LanguageFlag({
  code,
  width = 20,
  height = 14,
  className,
}: {
  code: SupportedLanguageCode | string
  width?: number
  height?: number
  className?: string
}) {
  switch (code) {
    case 'ka':
      return <FlagGE width={width} height={height} className={className} />
    case 'ru':
      return <FlagRU width={width} height={height} className={className} />
    case 'en':
    default:
      return <FlagGB width={width} height={height} className={className} />
  }
}
