# Study Space — plain HTML, CSS, and JavaScript

This starter intentionally uses **no React, no Vite, and no build step**. Each core page is a separate HTML file. Styles are in one shared stylesheet, and JavaScript is separated by feature so you can find and edit the logic easily.

## Pages
- `index.html` — landing page
- `login.html` — demo login
- `signup.html` — demo sign-up
- `dashboard.html` — overview and quick actions
- `classes.html` — add/remove classes
- `materials.html` — browse/delete saved material details
- `upload.html` — save notes/material details and select a file (file is not uploaded)
- `study-tools.html` — summary, flashcard, practice-question, and AI-tutor-prompt drafts

## Folder structure
```text
study-space/
├── index.html
├── login.html
├── signup.html
├── dashboard.html
├── classes.html
├── materials.html
├── upload.html
├── study-tools.html
├── css/
│   └── styles.css
└── js/
    ├── common.js
    ├── auth.js
    ├── dashboard.js
    ├── classes.js
    ├── materials.js
    ├── upload.js
    └── study-tools.js
```

## Run it
For a simple prototype, you can open `index.html` in your browser. For more reliable localStorage and clipboard behavior, use VS Code's Live Server extension and choose **Open with Live Server**.

## Friendly IDs
Useful IDs to search for in the HTML and JavaScript:
- Sign-up: `signupForm`, `signupName`, `signupEmail`, `signupPassword`, `signupMessage`
- Login: `loginForm`, `loginEmail`, `loginPassword`, `loginMessage`
- Dashboard: `welcomeHeading`, `classCount`, `materialCount`, `dashboardClasses`
- Classes: `addClassForm`, `className`, `classTeacher`, `classColor`, `classList`
- Materials: `addMaterialForm`, `materialTitle`, `materialType`, `materialClass`, `materialNotes`, `materialFile`, `materialsList`
- Study tools: `studySource`, `sourceWordCount`, `generateStudyContent`, `studyOutput`, `copyStudyOutput`

All IDs are deliberately descriptive. The JavaScript uses `document.getElementById("...")` and straightforward event listeners, so it should be easier to connect new logic later.

## Where to edit
- **HTML structure:** the page's `.html` file
- **Design:** `css/styles.css`
- **Shared storage and helpers:** `js/common.js`
- **Page behavior:** the matching `js/<page>.js` file

## Important prototype limitations
- Sign-up/login is a local demo, not secure authentication. Do not use real passwords or sensitive information.
- Data is stored in browser `localStorage`, not a database, so it does not sync between devices or users.
- The file picker only records a selected filename in the saved note; files are not uploaded or parsed.
- Study-tool drafts use simple browser-side demo logic, not a connected AI model.
- When you are ready, connect the forms to a Node.js/Express API and your hosted SQL database, and connect AI tools through a backend endpoint.
