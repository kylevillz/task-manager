import { useCallback, useEffect, useState } from 'react'
import { errorMessage, tasksApi } from '../api'

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTasks(await tasksApi.list())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Each mutation throws a readable message so the caller can show it inline.
  const run = async (fn) => {
    try {
      return await fn()
    } catch (err) {
      throw new Error(errorMessage(err))
    }
  }

  const replace = (updated) =>
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))

  const createTask = (data) =>
    run(async () => {
      const created = await tasksApi.create(data)
      setTasks((prev) => [created, ...prev])
    })

  const updateTask = (id, data) => run(async () => replace(await tasksApi.update(id, data)))

  const toggleTask = (id) => run(async () => replace(await tasksApi.toggle(id)))

  const deleteTask = (id) =>
    run(async () => {
      await tasksApi.remove(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
    })

  return { tasks, loading, error, reload: load, createTask, updateTask, toggleTask, deleteTask }
}
