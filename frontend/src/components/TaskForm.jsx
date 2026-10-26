import { useState } from 'react'

export default function TaskForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ title: title.trim(), description: description.trim() })
      if (!initial) {
        setTitle('')
        setDescription('')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        aria-label="Title"
        placeholder="Task title"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        disabled={saving}
        autoFocus={Boolean(initial)}
      />
      <textarea
        aria-label="Description"
        placeholder="Description (optional)"
        value={description}
        rows={2}
        onChange={(e) => setDescription(e.target.value)}
        disabled={saving}
      />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
