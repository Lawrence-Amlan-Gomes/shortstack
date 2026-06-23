import { useState } from 'react'

export default function App() {
  const [url, setUrl] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setShortUrl('')

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error) || 'Something went wrong')
      setShortUrl(data.short)
      setUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to shorten URL')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="container">
      <h1>ShortStack</h1>
      <p className="subtitle">Paste a long URL, get a short one.</p>

      <form onSubmit={handleSubmit} className="form">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com/very/long/url"
          required
          className="input"
        />
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Shortening...' : 'Shorten'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {shortUrl && (
        <div className="result">
          <a href={shortUrl} target="_blank" rel="noreferrer" className="short-url">
            {shortUrl}
          </a>
          <button onClick={handleCopy} className="btn btn-copy">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </main>
  )
}
