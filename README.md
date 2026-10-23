# TrafficConnect SA — Administration Dashboard

TrafficConnect SA is a web-based administration dashboard for the TrafficConnect SA traffic management project.

This repository contains the React, TypeScript, Vite and Firebase source code.

## 1. Requirements

Install the following software before starting:

- **Node.js:** Install the LTS version from https://nodejs.org/
- **Visual Studio Code:** Recommended code editor from https://code.visualstudio.com/
- **Git:** Optional for downloading the ZIP; required for cloning and pushing changes. Download from https://git-scm.com/downloads/

You do not need to install React, Vite or TypeScript globally. npm installs the project dependencies for you.

## 2. Download the project

### Option A: Download without Git

1. Open https://github.com/codingwithbenca/TrafficConnectSA-Dashboard
2. Click the green **Code** button.
3. Select **Download ZIP**.
4. Extract the ZIP file to a folder on your computer.
5. Open the extracted project folder in Visual Studio Code.

If the repository is private, you must be granted access to download it.

### Option B: Clone using Git

Open a terminal and run:

```bash
git clone https://github.com/codingwithbenca/TrafficConnectSA-Dashboard.git
cd TrafficConnectSA-Dashboard
```

## 3. Install project dependencies

Open a terminal in the folder containing `package.json` and run:

```bash
npm install
```

Wait for npm to finish installing the dependencies.

Do not copy another developer's `node_modules` folder. Each developer can install their own dependencies.

## 4. Configure Firebase

The dashboard uses Firebase Authentication, Cloud Firestore and Firebase Storage.

The current Firebase configuration is in:

`src/firebase.ts`

The project is currently configured to use the Firebase project named `schoolprojcet`.

Before using the dashboard, make sure:

- You have permission to access the Firebase project.
- Your account is authorized to sign in.
- The required Firestore and Storage security rules are configured.
- An authorized staff record exists if the dashboard requires one.

Firebase web configuration values are not server-side secrets. Never add service-account private keys, passwords, or other private server credentials to the source code or GitHub.

If Firebase configuration is moved to environment variables in a future version, follow the updated setup instructions before running the project.

## 5. Start the dashboard

Run:

```bash
npm run dev
```

Vite will display a local address in the terminal, usually:

`http://localhost:5173`

Open the address shown in your terminal in your browser.

Keep the terminal open while using the development server. Press `Ctrl+C` in the terminal to stop it.

## 6. Check the project

To check TypeScript and create a production build, run:

```bash
npm run build
```

To run the project's lint checks, run:

```bash
npm run lint
```

If a command reports errors, copy the full error message and share it with the project developer.

## 7. Common problems

### `npm` is not recognized

Install Node.js LTS, close and reopen your terminal, then check:

```bash
node --version
npm --version
```

### Missing packages or dependency errors

Make sure your terminal is in the project folder and run:

```bash
npm install
```

### Firebase permission or sign-in errors

Check that you are using an authorized account and that Firebase Authentication, Firestore rules and Storage rules allow the required operation.

Installing npm packages does not grant Firebase permissions.

### The local address does not open

Check the terminal for the actual Vite address. Another application may already be using port 5173.

## 8. Useful npm commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build the project |
| `npm run lint` | Run lint checks |
| `npm run preview` | Preview the production build locally |

## 9. Contributing changes

Before making changes, coordinate with the team to avoid overwriting another member's work.

For Git users:

```bash
git pull
git add .
git commit -m "Describe your changes"
git push
```

Only authorized collaborators can push to the repository.

## Project information

- **Project:** TrafficConnect SA
- **Repository:** https://github.com/codingwithbenca/TrafficConnectSA-Dashboard
- **Frontend:** React, TypeScript and Vite
- **Backend services:** Firebase Authentication, Cloud Firestore and Firebase Storage

This is a development setup guide. Running the dashboard locally does not automatically deploy it to a public website.
