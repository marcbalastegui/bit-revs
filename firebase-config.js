// firebase-config.js - Inicialización de Firebase

const firebaseConfig = {
    apiKey:            "AIzaSyC6rklsbHAvmvpOCdwdq2R6JAx7FKNudF4",
    authDomain:        "bitrevs.firebaseapp.com",
    projectId:         "bitrevs",
    storageBucket:     "bitrevs.firebasestorage.app",
    messagingSenderId: "27238850850",
    appId:             "1:27238850850:web:0ed933e4fe01bc1a65457b"
};

firebase.initializeApp(firebaseConfig);

const brDB   = firebase.firestore();
const brAuth = firebase.auth();
