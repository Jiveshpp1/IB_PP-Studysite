# Study Space

Study Space is a responsive student workspace built with HTML, CSS, vanilla JavaScript, Express, and MySQL. Student data and authentication are stored server-side; the browser does not use local storage for application data.

## Requirements

- Node.js 20 or newer
- MySQL 8 or compatible MySQL server
- A Resend account and verified sender address for email verification and password resets

## Run locally

1. Install the dependencies with `npm install`.
2. Create a MySQL database and tables by running `database/schema.sql`:

   ```sh
   mysql -u root -p < database/schema.sql
   ```

3. Copy `.env.example` to `.env` and set your database credentials and a long random `SESSION_SECRET`.
4. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Email/password signup is intentionally unavailable until email verification is configured.
5. Start the server:

   ```sh
   npm start
   ```

6. Open [http://localhost:3000](http://localhost:3000).

Use `npm run dev` for Node's watch mode. The server serves the frontend and API from the same origin. On a production deployment, set `NODE_ENV=production` to enable secure, HTTPS-only session cookies.

## Optional integrations

- **Google sign-in:** Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI`. Register the exact callback URL with Google.
- **AI Chat:** Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. Requests and credentials stay on the backend. Chat messages are saved even when AI is not configured; the interface reports that no AI response was generated.
- **Email:** Set a verified Resend sender using `RESEND_FROM_EMAIL`.

The settings page reports which integrations are configured without revealing credentials.

## Included functionality

- Signup with emailed verification codes, email/password login, logout, password recovery, and Google OAuth when configured.
- Private cookie-based sessions and server-side per-user authorization for application records.
- Class creation, editing, and deletion.
- Notebook organization, private source/document upload, and editable notes.
- Flashcard sets and cards, flip/navigation controls, and saved review counts.
- Multiple-choice quiz authoring, quiz taking, saved attempts, scores, and answer review.
- Assignment tracking, completion, deadlines, monthly calendar, and personal events.
- Persistent chat history and optional server-side OpenAI chat responses.

## Not included yet

- PDF/document text extraction and notebook-grounded AI conversations.
- Google Calendar synchronization.
- AI-generated quizzes, notes, or flashcards.

Uploaded files are limited to 5 MB and stored in MySQL. For larger-scale deployments, use private object storage and a background processing service rather than database file blobs.

## Validation

Run `npm run check` to check the Express server syntax. Ensure the MySQL schema is installed and required environment variables are configured before using the authenticated app.
