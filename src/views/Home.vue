<script setup>
import store from '../store';
import router from '../router/index';
import { db, auth } from '../firebase/init.js';
import { collection, addDoc, doc, setDoc, getDocs, serverTimestamp, query, where } from "firebase/firestore";
import { signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { notify } from "@kyvg/vue3-notification";
</script>

<template>
    <TransitionGroup name="fade" mode="out-in" appear>
        <div v-if="!showNewGame && !showJoinGame && !showLogin && !showAbout"
            class="home-container flex vertical y-centered">
            <h1>Emparejados</h1>
            <button class="main-button" @click="showContainer('newGame')">Nueva partida</button>
            <button class="main-button" @click="showContainer('joinGame')">Unirse a partida</button>
            <button class="main-button" @click="showContainer('login')">Gestión de cuenta</button>
            <button class="main-button" @click="showContainer('about')">Acerca de...</button>
        </div>

        <form v-if="showNewGame" class="new-game-container flex vertical y-centered" @submit.prevent="createGame">
            <h2>Nueva partida</h2>

            <div class="grid game-options large-bottom-margin">
                <h3 class="grid-full-row">Opciones</h3>
                <label class="grid-label bold" for="newGameCode">Código de partida</label>
                <input class="main-input" id="newGameCode" type="text" v-model="newGame.code" required />
                <label class="grid-label bold" for="newGameTime">Tiempo de juego</label>
                <input class="main-input" id="newGameTime" type="number" v-model="newGame.gameTime" required />
                <label class="grid-label bold" for="newGameMaxPlayers">Máximo de jugadores</label>
                <input class="main-input" id="newGameMaxPlayers" type="number" v-model="newGame.maxPlayers" required />
                <label class="grid-label bold flex y-centered" for="newGameCardsPerPlayer">Tarjetas por jugador</label>

                <div class="grid card-options">
                    <div class="flex vertical y-centered">
                        <span class="gold-text bold">Difíciles</span>
                        <input class="main-input cards-input" type="number" v-model="newGame.cardsPerPlayer.hard"
                            required />
                    </div>
                    <div class="flex vertical y-centered">
                        <span class="silver-text bold">Medias</span>
                        <input class="main-input cards-input" type="number" v-model="newGame.cardsPerPlayer.normal"
                            required />
                    </div>
                    <div class="flex vertical y-centered">
                        <span class="bronze-text bold">Fáciles</span>
                        <input class="main-input cards-input" type="number" v-model="newGame.cardsPerPlayer.easy"
                            required />
                    </div>
                </div>

                <div class="flex y-centered x-centered grid-full-row">
                    <input class="small-left-margin" id="newGameHintsEnabled" type="checkbox"
                        v-model="newGame.hintsEnabled" />
                    <label class="grid-label bold" for="newGameHintsEnabled">Habilitar pistas</label>
                </div>
            </div>

            <button class="container-button main-button" type="submit">Crear sala</button>
            <button class="container-button main-button" type="button" @click="showContainer('')">Volver</button>
        </form>

        <div v-if="showJoinGame" class="join-game-container flex vertical y-centered">
            <h2>Unirse a partida</h2>
            <label class="flex vertical input-label">
                Código de partida:
                <input class="main-input" type="text" v-model="joinGame.code" />
            </label>
            <img v-if="joiningGame" width="32" src="/img/loading.gif" alt="Loading..." style="background: transparent;" />
            <button class="container-button main-button" @click="joinGameByCode">Unirse a la sala</button>
            <button class="container-button main-button" @click="showContainer('')">Volver</button>
        </div>

        <div v-if="showLogin" class="login-container flex vertical y-centered">
            <div v-if="!isLoggedIn" class="login-container flex vertical wide y-centered">
                <h2>Iniciar sesión o registrarse</h2>
                <label class="flex vertical input-label">
                    Email:
                    <input class="main-input" type="email" v-model="login.email" required />
                </label>
                <label class="flex vertical input-label">
                    Contraseña:
                    <input class="main-input" type="password" v-model="login.password" required />
                </label>
                <p class="bold">Sólo al registrarse:</p>
                <label class="flex vertical input-label">
                    Nombre o apodo:
                    <input class="main-input" type="text" v-model="login.displayName" />
                </label>
                <button class="container-button main-button" @click="userLogin">Iniciar sesión</button>
                <button class="container-button main-button" @click="signup">Registrarse</button>
            </div>
            <div v-if="isLoggedIn" class="login-container flex vertical wide y-centered">
                <p>Te damos la bienvenida, {{ currentUser.displayName }}</p>
                <button class="container-button main-button" @click="signOutCall">Cerrar sesión</button>
            </div>

            <button class="container-button main-button" @click="showContainer('')">Volver</button>
        </div>
    </TransitionGroup>
</template>

<script>
export default {
    name: 'Home',
    data() {
        return {
            showNewGame: false,
            showJoinGame: false,
            showLogin: false,
            newGame: {
                code: '',
                maxPlayers: 30,
                cardsPerPlayer: {
                    easy: 2,
                    normal: 2,
                    hard: 1
                },
                hintsEnabled: false,
                gameTime: 15
            },
            joinGame: {
                code: ''
            },
            login: {
                email: '',
                password: '',
                displayName: ''
            },
            errorMessages: {
                'auth/email-already-in-use': 'Ya hay una cuenta con ese correo electrónico.',
                'auth/invalid-email': 'El email ingresado no es válido, usá arroba y dominio.',
                'auth/user-not-found': 'No se encontró una cuenta registrada con ese email.',
                'auth/wrong-password': 'La contraseña ingresada es incorrecta, probá de nuevo o reseteala.'
            },
            joiningGame: false,
        };
    },
    computed: {
        isLoggedIn() {
            return store.getters.isLoggedIn;
        },
        currentUser() {
            return store.getters.currentUser;
        },
    },
    methods: {
        showContainer(container) {
            this.showLogin = container === 'login';
            this.showAbout = container === 'about';

            if ((container === 'newGame' || container === 'joinGame') && this.isLoggedIn) {
                this.showNewGame = container === 'newGame';
                this.showJoinGame = container === 'joinGame';
            } else if ((container === 'newGame' || container === 'joinGame') && !this.isLoggedIn) {
                this.showNewGame = false;
                this.showJoinGame = false;
                return notify({
                    title: "Error de acceso",
                    text: "Debes iniciar sesión para acceder a esta sección.",
                    type: "error"
                });
            } else {
                this.showNewGame = false;
                this.showJoinGame = false;
            }
        },
        async createGame() {
            try {
                // Paso 1: Crear un documento en la colección "games"
                const gameRef = await addDoc(collection(db, "games"), {
                    gameCode: this.newGame.code,
                    maxPlayers: this.newGame.maxPlayers,
                    cardsPerPlayer: {
                        easy: this.newGame.cardsPerPlayer.easy,
                        normal: this.newGame.cardsPerPlayer.normal,
                        hard: this.newGame.cardsPerPlayer.hard
                    },
                    hintsEnabled: this.newGame.hintsEnabled,
                    createdAt: serverTimestamp(),
                    status: 'waiting',
                    timeLeft: this.newGame.gameTime,
                    host: this.currentUser.email,
                });

                // Paso 2: Crear un documento para el jugador en la subcolección "players"
                await this.joinPlayer(gameRef.id);

                router.push({ name: 'Lobby', params: { gameId: gameRef.id } });
            } catch (error) {
                return notify({
                    title: "Error creando partida",
                    text: "Se devuelve el siguiente error: " + error.message,
                    type: "error"
                });
            }
        },
        async joinPlayer(gameId) {
            await setDoc(doc(db, "games", gameId, "players", this.currentUser.uid), {
                avatar: '👤',
                email: this.currentUser.email,
                name: this.currentUser.displayName,
                joinedAt: serverTimestamp(),
                ready: false,
                score: 0,
                assignedCards: []
            });
        },
        async joinGameByCode() {
            if (this.joinGame.code === '') {
                return notify({
                    title: "Error al unirse",
                    text: "Debes ingresar un código de partida.",
                    type: "error"
                });
            }

            this.joiningGame = true;
            const gamesRef = collection(db, "games");
            const q = query(gamesRef, where("gameCode", "==", this.joinGame.code));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                this.joiningGame = false;
                return notify({
                    title: "Error al unirse",
                    text: "No se encontró una partida con ese código.",
                    type: "error"
                });
            }

            const gameDoc = querySnapshot.docs[0];
            const gameId = gameDoc.id;

            if (gameDoc.data().status !== 'waiting') {
                this.joiningGame = false;
                return notify({
                    title: "Error al unirse",
                    text: "La partida ya empezó o ya fue jugada.",
                    type: "error"
                });
            } else {
                const playersRef = collection(db, "games", gameId, "players");
                const playersSnapshot = await getDocs(playersRef);

                if (gameDoc.data().maxPlayers <= playersSnapshot.size) {
                    this.joiningGame = false;
                    return notify({
                        title: "Error al unirse",
                        text: "La sala ya está llena hasta el máximo permitido.",
                        type: "error"
                    });
                }
            }

            await this.joinPlayer(gameId);

            router.push({ name: 'Lobby', params: { gameId: gameId } });
        },
        async signup() {
            if (this.login.displayName === '') {
                return notify({
                    title: "Error de registro",
                    text: "Debes ingresar un nombre o apodo al registrarte.",
                    type: "error"
                });
            }
            const that = this;

            createUserWithEmailAndPassword(auth, this.login.email, this.login.password)
                .then((data) => {
                    setDoc(doc(db, "users", data.user.uid), {
                        uid: data.user.uid,
                        email: that.login.email,
                        name: that.login.displayName || "",
                        createdAt: serverTimestamp(),
                    }, { merge: true }).then(() => {
                        updateProfile(auth.currentUser, { displayName: that.login.displayName })
                            .then(function () {
                                notify({
                                    title: "Estado de sesión",
                                    text: "Creaste tu cuenta correctamente!",
                                    type: "success"
                                });
                                that.showContainer('');
                            })
                            .catch(
                                (err) => console.log(err)
                            );
                    });
                })
                .catch(error => {
                    notify({
                        title: "Error al registrarse",
                        text: that.errorMessages[error.code] || error.message,
                        type: "error"
                    });
                });
        },
        async userLogin() {
            const that = this;

            setPersistence(auth, browserLocalPersistence)
                .then(() => {
                    signInWithEmailAndPassword(auth, this.login.email, this.login.password)
                        .then((data) => {
                            notify({
                                title: "Estado de sesión",
                                text: "Iniciaste sesión exitosamente!",
                                type: "success"
                            });
                            that.showContainer('');
                        })
                        .catch(error => {
                            notify({
                                title: "Error al iniciar sesión",
                                text: that.errorMessages[error.code],
                                type: "error"
                            });
                        });
                })
                .catch((error) => {
                    const errorCode = error.code;
                    const errorMessage = error.message;
                    notify({
                        title: errorCode,
                        text: errorMessage,
                        type: "error"
                    });
                });
        },
        async signOutCall() {
            await signOut(auth).then(function () {
                notify({
                    title: 'Estado de sesión',
                    text: 'Cerraste tu sesión de manera segura.',
                    type: 'warning'
                })
            });
        },
    },
}
</script>

<style scoped>
.main-button {
    margin-bottom: 15px;
}

.main-button:last-of-type {
    margin-bottom: 0;
}

.game-options {
    grid-template-columns: 45% 55%;
    row-gap: 10px;
}

.card-options {
    grid-template-columns: 33% 33% 33%;
    row-gap: 1px;
}

.cards-input {
    width: 75%;
}

.input-label {
    margin-bottom: 10px;
}

.grid-label {
    text-align: left;
}

.container-button {
    margin-bottom: 10px;
}

.container-button:first-of-type {
    margin-top: 15px;
}

.container-button:last-of-type {
    margin-bottom: 0;
}

h1 {
    color: #42b983;
}
</style>