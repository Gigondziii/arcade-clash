import Avatar from '../components/Avatar'
import Navbar from '../components/Navbar'
import { useAuth } from '../auth/AuthContext'

type ProfilePageProps = {
  onNavigateHome: () => void
}

export default function ProfilePage({ onNavigateHome }: ProfilePageProps) {
  const { user } = useAuth()

  if (!user) {
    // Shouldn't normally be reachable — App.tsx only shows this view when
    // logged in — but fail gracefully rather than crash if it ever is.
    return (
      <>
        <Navbar onNavigateHome={onNavigateHome} onNavigateProfile={() => {}} />
        <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
          <p className="ac-text-muted">You're not logged in.</p>
        </main>
      </>
    )
  }

  const winRate = user.gamesPlayed > 0 ? `${Math.round((user.gamesWon / user.gamesPlayed) * 100)}%` : '—'

  return (
    <>
      <Navbar onNavigateHome={onNavigateHome} onNavigateProfile={() => {}} />
      <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
          <Avatar username={user.username} size={72} />
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-3xl)' }}>{user.username}</h1>
            <p className="ac-text-muted" style={{ margin: 'var(--space-1) 0 0' }}>
              Joined {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div
          className="ac-panel"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}
        >
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              Games Played
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {user.gamesPlayed}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              Win Rate
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>{winRate}</div>
          </div>
        </div>
        <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-3)' }}>
          Stats are placeholders until matchmaking and real match results exist.
        </p>
      </main>
    </>
  )
}
