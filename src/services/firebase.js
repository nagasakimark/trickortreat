import firebase from 'firebase/app'
import 'firebase/database'

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyBvAY3gapbiSr2lOrBtge1SeKmHgtLoJ9Y',
  authDomain: 'directions-game.firebaseapp.com',
  databaseURL: 'https://directions-game-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'directions-game',
  storageBucket: 'directions-game.firebasestorage.app',
  messagingSenderId: '147265691150',
  appId: '1:147265691150:web:bb58a53271fe7fe831a65f'
}

// Initialize Firebase (v8 syntax)
if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig)
}

const database = firebase.database()

export { firebase, database }
export default firebase
