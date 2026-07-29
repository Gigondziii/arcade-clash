type StarRatingProps = { rating: number; max?: number }

export default function StarRating({ rating, max = 5 }: StarRatingProps) {
  const filled = Math.round(rating)
  return (
    <span aria-label={`${rating} out of ${max} stars`} style={{ fontSize: 'var(--font-size-sm)' }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < filled ? 'ac-star--filled' : 'ac-star--empty'}>
          ★
        </span>
      ))}
    </span>
  )
}
