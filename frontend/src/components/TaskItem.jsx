import { useState } from 'react'
import TaskForm from './TaskForm'

export default function TaskItem({ task, onUpdate, onToggle, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const act = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <li className="task editing">
        <TaskForm
          initial={task}
          submitLabel="Save"
          onSubmit={async (data) => {
            await onUpdate(task.id, data)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  const handleDelete = () => {
    if (window.confirm(`Delete "${task.title}"?`)) act(() => onDelete(task.id))
  }

  return (
    <li className={`task${task.completed ? ' done' : ''}`}>
      <input
        type="checkbox"
        aria-label={`Mark "${task.title}" as ${task.completed ? 'not completed' : 'completed'}`}
        checked={task.completed}
        disabled={busy}
        onChange={() => act(() => onToggle(task.id))}
      />
      <div className="body">
        <h3>{task.title}</h3>
        {task.description && <p>{task.description}</p>}
        <time dateTime={task.created_at}>{new Date(task.created_at).toLocaleString()}</time>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="actions">
        <button onClick={() => setEditing(true)} disabled={busy}>Edit</button>
        <button className="danger" onClick={handleDelete} disabled={busy}>Delete</button>
      </div>
    </li>
  )
}
