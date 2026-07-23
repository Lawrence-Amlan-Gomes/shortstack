// This is the App.tsx file. What this file does is render the whole ShortStack frontend:
// a single form where anyone can paste a long URL and get a short one back, no login
// required. It talks to the Express API's /api/links route to create the short link.

import { useState } from 'react' // Bring in React's 'useState' tool, used to remember values that can change

export default function App() { // Define the main App component, the one thing main.tsx renders
  const [url, setUrl] = useState('') // Remember what the user has typed into the "URL to shorten" field
  const [shortUrl, setShortUrl] = useState('') // Remember the short URL we got back after shortening
  const [copied, setCopied] = useState(false) // Remember whether the "copy" button was just clicked (to show "Copied!" briefly)
  const [loading, setLoading] = useState(false) // Remember whether a shorten-URL request is currently in flight
  const [error, setError] = useState('') // Remember the latest error message, if any

  async function handleSubmit(e: React.FormEvent) { // Define what happens when the "shorten a URL" form is submitted
    e.preventDefault() // Stop the browser's default "reload the page" behavior for form submissions
    setLoading(true) // Show the loading state while the request is in flight
    setError('') // Clear any old error message before trying again
    setShortUrl('') // Clear any previous short URL before making a new one

    try { // Try to shorten the URL, and catch it if something goes wrong
      const res = await fetch('/api/links', { // Wait while we send the request to create a new short link
        method: 'POST', // Always a POST request to create a link
        headers: { 'Content-Type': 'application/json' }, // Tell the server we're sending JSON
        body: JSON.stringify({ url }), // Send the URL the user typed in
      }) // End of the fetch call
      const data = await res.json() // Wait while we read and parse the JSON response body
      if (!res.ok) throw new Error(JSON.stringify(data.error) || 'Something went wrong') // If it failed, throw an error with the details
      setShortUrl(data.short) // Success — save the short URL we got back so it can be shown
      setUrl('') // Clear the input field now that the link was created
    } catch (err) { // If anything above threw an error
      setError(err instanceof Error ? err.message : 'Failed to shorten URL') // Show a readable error message to the user
    } finally { // Whether it succeeded or failed
      setLoading(false) // Turn off the loading state
    } // End of the try/catch/finally
  } // End of the handleSubmit function

  async function handleCopy() { // Define what happens when the user clicks "Copy"
    await navigator.clipboard.writeText(shortUrl) // Wait while we copy the short URL to the system clipboard
    setCopied(true) // Show "Copied!" on the button
    setTimeout(() => setCopied(false), 2000) // After 2 seconds, go back to showing "Copy" again
  } // End of the handleCopy function

  return ( // Build what gets shown on screen
    <main className="container"> {/* The centered page wrapper */}
      <h1>ShortStack</h1> {/* The site title */}
      <p className="subtitle">Paste a long URL, get a short one.</p> {/* Instructions for the form */}

      <form onSubmit={handleSubmit} className="form"> {/* The shorten-URL form */}
        <input // The URL input box
          type="url" // Only accept text shaped like a web address
          value={url} // Show whatever is currently typed
          onChange={e => setUrl(e.target.value)} // Update our remembered value whenever the user types
          placeholder="https://example.com/very/long/url" // Grey hint text shown when empty
          required // The browser won't submit the form if this is empty
          className="input" // Reuse the app's input styling
        />
        <button type="submit" disabled={loading} className="btn btn-primary"> {/* The submit button, disabled while a request is in flight */}
          {loading ? 'Shortening...' : 'Shorten'} {/* Button text changes based on loading state */}
        </button>
      </form>

      {error && <p className="error">{error}</p>} {/* Only show the error paragraph if there is an error message */}

      {shortUrl && ( // Only show the result box if we actually have a short URL
        <div className="result"> {/* The box showing the finished short link */}
          <a href={shortUrl} target="_blank" rel="noreferrer" className="short-url"> {/* The short link itself, opens in a new tab */}
            {shortUrl}
          </a>
          <button onClick={handleCopy} className="btn btn-copy"> {/* The copy-to-clipboard button */}
            {copied ? 'Copied!' : 'Copy'} {/* Button text changes briefly after copying */}
          </button>
        </div>
      )}
    </main>
  ) // End of the JSX
} // End of the App component
