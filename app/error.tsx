'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="text-6xl mb-6">⚠️</div>
      <h2 className="text-3xl font-heading font-bold text-primary mb-4">
        Something went wrong
      </h2>
      <p className="text-text-slate mb-8">
        We're having trouble loading this page. This could be a temporary issue.
      </p>
      <div className="flex gap-4 justify-center">
        <button onClick={reset} className="btn-primary">
          Try Again
        </button>
        <Link href="/" className="btn-secondary">
          Go Home
        </Link>
      </div>
    </div>
  )
}
