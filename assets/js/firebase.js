const firebaseConfig = {
  apiKey: "AIzaSyDxhy4n68kcjV9bdTdNY2k2fHz-o-vaJmA",
  authDomain: "svdsb-88e37.firebaseapp.com",
  databaseURL: "https://svdsb-88e37-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "svdsb-88e37",
  storageBucket: "svdsb-88e37.firebasestorage.app",
  messagingSenderId: "845566708941",
  appId: "1:845566708941:web:fd758d002adedf86266d84",
  measurementId: "G-LMRT4EFPTC"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();