# Task Manager

A small task manager: Django REST Framework API + React (Hooks) frontend.

```
/backend    Django project (config/) with a `tasks` app, SQLite database
/frontend   React app built with Vite, Axios for API calls
```

## Requirements

- Python 3.10+
- Node.js 18+ and npm

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver       # http://127.0.0.1:8000
```

Run the API tests:

```bash
python manage.py test
```

Optional: `python manage.py createsuperuser`, then manage tasks at http://127.0.0.1:8000/admin/.

## Frontend setup

In a second terminal, with the backend running:

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

The API URL defaults to `http://127.0.0.1:8000`. To change it, copy `.env.example` to `.env` and set `VITE_API_URL`.

## API endpoints

All endpoints use JSON. The view is a `viewsets.ViewSet` (not `ModelViewSet`), registered with a DRF router.

| Method | Path | Description | Body | Success |
|---|---|---|---|---|
| GET | `/tasks/` | List all tasks, newest first | – | 200 |
| POST | `/tasks/` | Create a task | `{"title": "...", "description": "..."}` | 201 |
| GET | `/tasks/{id}/` | Retrieve one task | – | 200 |
| PUT | `/tasks/{id}/` | Update title and description | `{"title": "...", "description": "..."}` | 200 |
| PATCH | `/tasks/{id}/` | Toggle `completed` | `{}` (or `{"completed": true}`) | 200 |
| DELETE | `/tasks/{id}/` | Delete a task | – | 204 |

Task object:

```json
{
  "id": 1,
  "title": "Write README",
  "description": "",
  "completed": false,
  "created_at": "2026-10-26T09:30:00.000000Z"
}
```

Errors: `400` with field errors (for example `{"title": ["This field is required."]}`), `404` for an unknown id.

## Notes and assumptions

- **PATCH only changes `completed`.** An empty body flips the current value. A body of `{"completed": true|false}` sets it explicitly. Any other field returns `400`, so title and description go through PUT.
- **PUT ignores `completed`.** It updates title and description only, as the spec says. `title` is required on PUT; `description` defaults to an empty string.
- **Title** is required, trimmed, and limited to 200 characters. Blank titles are rejected.
- **Description** is optional and stored as an empty string when left out.
- **No authentication.** The spec does not mention users, so the API is open (`AllowAny`, no auth classes). This also means no CSRF token is needed from the frontend.
- **CORS** allows `http://localhost:5173` and `http://127.0.0.1:5173` (the Vite dev server) via `django-cors-headers`.
- Tasks are ordered newest first.
- The frontend shows a loading state on first load, a retry button if the API cannot be reached, inline errors per form or task, and disables buttons while a request is in flight. Delete asks for confirmation.
- The frontend updates its local list from each API response instead of re-fetching the whole list.
