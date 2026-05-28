# Team Management Portal

## Tech Stack
- HTML
- CSS
- JavaScript
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting

## Features
- Home Dashboard
- Task Management
- Settings / Profile
- Admin Panel
- Team Member Panel

## Setup
1. Create Firebase project.
2. Enable Email/Password Authentication.
3. Create Firestore database.
4. Paste Firebase config in `assets/js/firebase.js`.
5. Add `firestore.rules` in Firebase console or deploy using CLI.
6. Run on Firebase Hosting.

## Notes
- Admin and member access is controlled through Firestore rules.
- For true production security, consider Firebase custom claims for admin roles [web:55][web:19].