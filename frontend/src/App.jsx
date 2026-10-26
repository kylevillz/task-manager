import TaskForm from './components/TaskForm'
import TaskItem from './components/TaskItem'
import { useTasks } from './hooks/useTasks'

export default function App() {
  const { tasks, loading, error, reload, createTask, updateTask, toggleTask, deleteTask } = useTasks()
  const remaining = tasks.filter((t) => !t.completed).length

  return (
    <main className="app">
      <header>
        <h1>Task Manager</h1>
        {!loading && !error && (
          <span className="count">
            {remaining} of {tasks.length} left
          </span>
        )}
      </header>

      <section className="card">
        <h2>New task</h2>
        <TaskForm submitLabel="Add task" onSubmit={createTask} />
      </section>

      <section>
        {loading && <p className="status">Loading tasks…</p>}
        {error && (
          <div className="status error" role="alert">
            <p>{error}</p>
            <button onClick={reload}>Retry</button>
          </div>
        )}
        {!loading && !error && tasks.length === 0 && (
          <p className="status">No tasks yet. Add one above.</p>
        )}
        {!loading && !error && tasks.length > 0 && (
          <ul className="task-list">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={updateTask}
                onToggle={toggleTask}
                onDelete={deleteTask}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
