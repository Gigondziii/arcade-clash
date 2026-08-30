import { categoryColors } from '@fugluck/theme'

const PALETTE = Object.values(categoryColors)

function colorForUsername(username: string): string {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

type AvatarProps = {
  username: string
  size?: number
}

export default function Avatar({ username, size = 32 }: AvatarProps) {
  const color = colorForUsername(username)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-full)',
        background: `color-mix(in srgb, ${color} 30%, var(--color-surface-raised))`,
        border: `1px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 'var(--font-weight-bold)',
        color,
        flexShrink: 0,
      }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  )
}
