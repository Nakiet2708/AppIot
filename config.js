// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB4qzwYzJV17az7JkqGRU7A-lSk45mCdzI",
    authDomain: "project-iot-4bef7.firebaseapp.com",
    databaseURL: "https://project-iot-4bef7-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "project-iot-4bef7",
    storageBucket: "project-iot-4bef7.firebasestorage.app",
    messagingSenderId: "303176651561",
    appId: "1:303176651561:web:4f64bbe50394c807c29d38"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { app, auth, database };