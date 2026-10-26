# Implementation Notes

This document explains how the Task Manager was built, the decisions made along the way, and why. For setup steps and the endpoint table, see [README.md](README.md).

## 1. Architecture overview

```
┌──────────────────────┐   HTTP/JSON (Axios)   ┌──────────────────────────┐
│ React (Vite)         │ ────────────────────▶ │ Django + DRF             │
│ localhost:5173       │ ◀──────────────────── │ 127.0.0.1:8000           │
│                      │                       │                          │
│ App                  │                       │ router  /tasks/          │
│  ├─ TaskForm         │                       │ TaskViewSet (ViewSet)    │
│  └─ TaskItem[]       │                       │ TaskSerializer           │
│ useTasks (state)     │                       │ Task model               │
│ api.js (Axios)       │                       │ SQLite (db.sqlite3)      │
└──────────────────────┘                       └──────────────────────────┘
```

The two apps are independent. The frontend talks to the backend only through the REST API. CORS allows the browser on port 5173 to call port 8000.

## 2. Backend

### 2.1 Project layout

```
backend/
├── config/            Django project: settings.py, urls.py
├── tasks/             The tasks app
│   ├── models.py      Task model
│   ├── serializers.py TaskSerializer
│   ├── views.py       TaskViewSet
│   ├── urls.py        DRF router
│   ├── admin.py       Admin registration
│   └── tests/         API tests
└── requirements.txt
```

### 2.2 Model — `tasks/models.py`

The model follows the spec field for field:

| Field | Type | Notes |
|---|---|---|
| `id` | AutoField | Django adds it automatically |
| `title` | CharField(max_length=200) | Required |
| `description` | TextField(blank=True, default='') | Optional |
| `completed` | BooleanField(default=False) | |
| `created_at` | DateTimeField(auto_now_add=True) | Set once at creation |

Decisions:
- `description` uses `blank=True, default=''` rather than `null=True`. Django convention for text fields is to store "no value" as an empty string, so there is only one empty state to handle, not two (`null` and `''`).
- `Meta.ordering = ['-created_at']` makes every query return newest tasks first. The list endpoint and the UI both rely on this.

### 2.3 Serializer — `tasks/serializers.py`

One `ModelSerializer` handles input validation and output formatting.

- `id`, `completed` and `created_at` are `read_only_fields`. The client cannot set them through POST or PUT.
- Making `completed` read-only is how **PUT is restricted to title and description**, as the spec requires. If a client sends `"completed": true` in a PUT, the serializer ignores it.
- `validate_title` trims whitespace and rejects a blank title. Without this, `"   "` would pass CharField's required check.

### 2.4 ViewSet — `tasks/views.py`

The spec asks for `viewsets.ViewSet`, not `ModelViewSet`. The difference:

- `ModelViewSet` gives you all CRUD actions for free via mixins.
- `ViewSet` gives you only routing. You write each action method yourself.

So `TaskViewSet` implements the five standard actions by hand. The router maps HTTP methods to them:

| HTTP | URL | ViewSet method | What it does |
|---|---|---|---|
| GET | `/tasks/` | `list` | Query all tasks, serialize with `many=True` |
| POST | `/tasks/` | `create` | Validate with the serializer, save, return 201 |
| GET | `/tasks/{id}/` | `retrieve` | `get_object_or_404`, serialize |
| PUT | `/tasks/{id}/` | `update` | Full validation of title/description, save |
| PATCH | `/tasks/{id}/` | `partial_update` | Toggle `completed` (custom logic, see below) |
| DELETE | `/tasks/{id}/` | `destroy` | Delete, return 204 |

Shared patterns:
- `get_object_or_404(Task, pk=pk)` turns a missing id into a 404 response.
- `serializer.is_valid(raise_exception=True)` turns validation failures into a 400 response with field errors. DRF's exception handler formats them.

#### PATCH: the custom part

The spec says PATCH should "toggle task completed status only". A normal DRF partial update would accept any field, so `partial_update` is written by hand:

1. Reject any key other than `completed` with a 400. Title and description changes must go through PUT.
2. If the body has `completed`, it must be a real boolean. Set it to that value.
3. If the body is empty, flip the current value (`not task.completed`).
4. Save with `update_fields=['completed']`, so the SQL `UPDATE` touches only that column.

Supporting both forms (empty body to toggle, explicit value to set) keeps the spec's "toggle" meaning but also gives clients an idempotent option. Sending `{"completed": true}` twice gives the same result, while toggling twice undoes itself.

### 2.5 Routing — `tasks/urls.py`, `config/urls.py`

```python
router = DefaultRouter()
router.register('tasks', TaskViewSet, basename='task')
```

The router generates `/tasks/` and `/tasks/{id}/` from the ViewSet's method names. `basename` is required because the ViewSet has no `queryset` attribute for the router to infer a name from. `config/urls.py` includes the router at the root, so the endpoints match the spec exactly (`/tasks/`, not `/api/tasks/`).

### 2.6 Settings — `config/settings.py`

Three changes from the Django defaults:

1. **Installed apps:** `rest_framework`, `corsheaders`, `tasks`.
2. **CORS:** `django-cors-headers` middleware, placed near the top of `MIDDLEWARE` so it can add headers to every response. `CORS_ALLOWED_ORIGINS` lists only the Vite dev server origins.
3. **No authentication:** The spec has no users. DRF's default `SessionAuthentication` enforces CSRF checks, which would block the React app's POST/PUT/PATCH/DELETE requests. Setting `DEFAULT_AUTHENTICATION_CLASSES = []` and `AllowAny` removes that, and makes the "open API" choice explicit.

### 2.7 Tests — `tasks/tests/test_api.py`

10 tests using DRF's `APITestCase`. Each one runs against a fresh test database. They cover:

- list, create, retrieve
- create with a blank title returns 400
- retrieve with an unknown id returns 404
- PUT changes title and description, and does **not** change `completed`
- PATCH with an empty body toggles both ways
- PATCH with an explicit value sets it
- PATCH with another field returns 400
- delete returns 204 and removes the row

Run them with `python manage.py test`.

## 3. Frontend

### 3.1 Layout

```
frontend/src/
├── main.jsx              Mounts <App/>
├── App.jsx               Page layout, list rendering, page-level states
├── api.js                Axios client + error formatting
├── hooks/useTasks.js     Task state + CRUD operations
├── components/
│   ├── TaskForm.jsx      Create and edit form (shared)
│   └── TaskItem.jsx      One task row: toggle, edit, delete
└── index.css             Styles (light + dark mode)
```

The code is split into three layers. Each layer has one job:

1. **`api.js`** knows HTTP. Nothing else imports Axios.
2. **`useTasks`** knows state. It holds the task list and exposes CRUD functions.
3. **Components** know UI. They call hook functions and show results.

### 3.2 API layer — `api.js`

- One Axios instance with `baseURL` from `VITE_API_URL` (default `http://127.0.0.1:8000`) and a 10 s timeout.
- `tasksApi` has one function per endpoint. Each returns `response.data`, so callers never deal with Axios response objects.
- `toggle` sends PATCH with an empty body, which uses the backend's toggle behaviour.
- `errorMessage(err)` turns any Axios error into one readable sentence:
  - No response at all (server down, CORS, timeout): "Cannot reach the API…"
  - DRF `detail` message: show it.
  - DRF field errors like `{"title": ["…"]}`: show the first one as `title: …`.
  - Anything else: `Request failed (status).`

### 3.3 State hook — `hooks/useTasks.js`

The hook owns `tasks`, `loading` and `error`.

- **Initial load:** `useEffect` calls `load()` on mount. `load` sets `loading`, fetches the list, and stores either the tasks or an error message. `load` is also exposed as `reload` for the Retry button.
- **Mutations:** `createTask`, `updateTask`, `toggleTask`, `deleteTask`. Each one:
  1. Calls the API.
  2. Updates local state **from the server's response**, not by re-fetching the full list:
     - create: put the new task at the front (matches newest-first order)
     - update / toggle: replace the task with the same id
     - delete: filter it out
  3. On failure, throws an `Error` with the readable message from `errorMessage`.

Why update from the response: it costs one request instead of two, and the UI shows exactly what the server stored (for example, the trimmed title and the real `created_at`).

Why throw instead of storing a global error: a failure belongs to one form or one task row. Throwing lets the component that started the action show the error next to it, while the page-level `error` stays reserved for "the list could not load".

These are not optimistic updates. The UI changes only after the server confirms. That is simpler and never shows a state the server rejected. The trade-off is a short delay on each action.

### 3.4 Components

**`TaskForm.jsx`** is used for both create and edit:
- With no `initial` prop it is the create form. It clears itself after a successful submit.
- With `initial={task}` it is the edit form. It pre-fills the fields, autofocuses the title, and shows a Cancel button.
- It checks for a blank title before sending, so the user gets instant feedback without a request. The server validates again; the client check is only for convenience.
- While saving, inputs and buttons are disabled and the button reads "Saving…". This prevents double submits.

**`TaskItem.jsx`** renders one task and switches between view mode and edit mode with local `editing` state.
- Checkbox: toggles `completed`.
- Edit: swaps the row for a `TaskForm`. On save, it calls `onUpdate` and leaves edit mode. If the save fails, the form stays open and shows the error.
- Delete: asks `window.confirm` first.
- A local `busy` flag disables the row's controls during a request, and a local `error` shows failures under the task.
- Completed tasks get a strike-through title.

**`App.jsx`** composes everything and handles page-level states, in this order:
1. `loading`: "Loading tasks…"
2. `error`: error banner with a Retry button
3. empty list: "No tasks yet. Add one above."
4. otherwise: the task list

The header shows "N of M left", counting tasks not completed.

### 3.5 Styling — `index.css`

Plain CSS with custom properties (`--bg`, `--text`, `--accent`, …). A `prefers-color-scheme: dark` block redefines them, so dark mode needs no extra code. A small media query wraps task actions under the text on narrow screens. There is no UI library, to keep dependencies low.

## 4. Request lifecycle example: marking a task completed

1. User clicks the checkbox in `TaskItem`.
2. `TaskItem` sets `busy = true` (checkbox disabled) and calls `onToggle(id)`.
3. `useTasks.toggleTask` calls `tasksApi.toggle(id)`, which sends `PATCH /tasks/5/` with `{}`.
4. Django's CORS middleware accepts the origin. The router sends the request to `TaskViewSet.partial_update`.
5. The view sees an empty body, flips `completed`, saves that one column, and returns the serialized task.
6. `useTasks` replaces task 5 in state with the response.
7. React re-renders: checkbox checked, title struck through, "left" count drops by one.
8. `TaskItem` sets `busy = false`.

If step 4 or 5 fails, `errorMessage` turns the failure into one sentence, `toggleTask` throws it, and `TaskItem` shows it under the task. The checkbox stays in its old state, because the state was never changed.

## 5. Verification done

- Backend: all 10 API tests pass.
- End to end in a browser, with both servers running:
  - Created a task with and without a description.
  - Edited a task's title and description.
  - Toggled a task to completed (strike-through, count updated).
  - Deleted a task (with confirmation).
  - Checked through `GET /tasks/` that the database matched the UI.
  - Stopped the backend and reloaded: the "Cannot reach the API" banner and Retry button appeared.
  - No console errors.

## 6. Assumptions and possible improvements

Assumptions (also listed in the README):
- No authentication or per-user tasks.
- PATCH accepts only `completed`; PUT ignores `completed`.
- Title is limited to 200 characters.

What I would add with more time:
- **Pagination** on `GET /tasks/` for large lists.
- **Optimistic updates** for toggle, with rollback on failure, so the checkbox responds instantly.
- **Frontend tests** with Vitest and React Testing Library, mocking `api.js`.
- **Filters** (all / active / completed) and sorting.
- **Authentication** (token or session) with tasks linked to a user.
- **Production config:** `DEBUG=False`, `SECRET_KEY` and `ALLOWED_HOSTS` from environment variables, and serving the built frontend.
