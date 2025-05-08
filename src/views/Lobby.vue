<script setup>
import router from '../router/index';
import store from '../store';
import VueQrcode from 'vue-qrcode';
import AnimateHeight from 'vue-animate-height';
import { db } from '../firebase/init.js';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { notify } from '@kyvg/vue3-notification';
import emojis from '../assets/emojis.js';

const baseUrl = import.meta.env.VITE_BASE_URL || 'https://emparejados.com.ar';
</script>

<template>
    <TransitionGroup name="fade" mode="out-in" appear>
        <!-- Si no está loggeado -->
        <div v-if="!currentUser" class="flex vertical y-centered wide">
            <p>Inicia sesión en <span class="bold">"Gestión de cuenta"</span> para unirte a la partida!</p>
        </div>
        <div v-else class="flex vertical y-centered wide">
            <!-- Si NO cargó gameData -->
            <div class="loading flex vertical y-centered wide large-bottom-margin" v-if="!gameData">
                <img width="64" src="/img/loading.gif" alt="Loading..." style="background: transparent;" />
                <span>Cargando...</span>
            </div>

            <!-- Si cargó gameData -->
            <div class="flex vertical wide y-centered" v-if="gameData">
                <h2 style="margin-bottom: 5px;">Partida: {{ gameData.gameCode }}</h2>
                <button id="qrButton" class="main-button" v-if="qrHeight === 0"
                    @click="updateHeight('qrHeight')">Mostrar QR del
                    código</button>
                <AnimateHeight :duration="400" :height="qrHeight" :animate-opacity="true">
                    <vue-qrcode class="game-qr" :value="`${baseUrl}/lobby/${gameId}`" />
                </AnimateHeight>

                <h3 class="small-bottom-margin large-top-margin">Jugadores en la sala</h3>
                <p class="small-top-margin">{{ gamePlayers.length }} en total, <span class="success-text">{{
                    readyPlayers.length }} puede(n) empezar</span>.</p>
                <p v-if="!hasHost && gamePlayers.length > 0" class="alert-text bold small-top-margin">
                    El creador de la partida no está presente.
                </p>
                <TransitionGroup class="players-list flex vertical x-centered small-bottom-margin"
                    v-if="gamePlayers.length > 0" name="fade" tag="div">

                    <div class="listed-player flex left y-centered"
                        :class="{ 'host': player.email === gameData?.host, 'you': currentUser.email === player.email }"
                        v-for="(player, index) in gamePlayers" :key="index">
                        <span v-if="currentUser.email !== player.email"
                            class="listed-player-avatar large-right-margin">{{ player.avatar }}</span>
                        <select v-if="currentUser.email === player.email" v-model="player.avatar"
                            @change="updateAvatar(player.id, player.avatar)" class="avatar-select large-right-margin">
                            <option v-for="emoji in emojis" :key="emoji" :value="emoji">{{ emoji }}</option>
                        </select>
                        <div class="flex vertical left">
                            <div class="flex">
                                <span class="listed-player-name">{{ player.name }}</span>
                                <span v-if="player.email === gameData?.host"
                                    class="listed-player-ishost bold small-left-margin">Host
                                </span>
                                <span v-if="player.email === currentUser.email"
                                    class="listed-player-isyou bold small-left-margin">Vos
                                </span>
                            </div>
                            <Transition name="fade" mode="out-in" appear>
                                <span class="listed-player-status" :class="{ 'success-text': player.ready }"
                                    :key="player.ready">
                                    {{ player.ready ? '✅️ Listo/a' : '⏳ Preparándose' }}
                                </span>
                            </Transition>
                        </div>

                        <button class="kick-button bold tall" v-if="isHost && player.email !== currentUser.email"
                            @click="kickPlayer(player.id)">⛔</button>
                        <button class="ready-button bold tall" v-if="player.email === currentUser.email"
                            @click="toggleReady">{{ player.ready ? '⏳' : '✅️' }}</button>
                    </div>
                </TransitionGroup>

                <h3>Características</h3>
                <div class="flex vertical y-centered large-bottom-margin">
                    <span>Máximo de jugadores: {{ gameData.maxPlayers }}</span>
                    <span>Tarjetas por jugador: 🟡{{ gameData.cardsPerPlayer.hard }}, ⚪{{
                        gameData.cardsPerPlayer.normal }} y 🟤{{ gameData.cardsPerPlayer.easy }}</span>
                    <span>Pistas habilitadas: {{ gameData.hintsEnabled ? 'Sí' : 'No' }}</span>
                </div>

                <p v-if="!isHost" class="bold small-bottom-margin">⚠️ Esperando el inicio de la partida.</p>
                <button v-if="isHost" class="start-button container-button main-button medium-top-margin"
                    :class="{ 'disabled': gamePlayers.length > readyPlayers.length }" @click="startGame">Iniciar
                    partida</button>
            </div>
        </div>

        <button class="container-button main-button medium-top-margin large-bottom-margin">
            <router-link to="/" class="block">Volver al menú</router-link>
        </button>
    </TransitionGroup>
</template>

<script>
export default {
    name: 'Lobby',
    props: ['gameId'],
    components: {
        VueQrcode, AnimateHeight
    },
    data() {
        return {
            qrHeight: 0,
            isTransitioningToGame: false
        };
    },
    computed: {
        gamePlayers() {
            return store.getters.players;
        },
        readyPlayers() {
            return this.gamePlayers.filter(player => player.ready);
        },
        hasHost() {
            return this.gamePlayers.some(player => player.email === this.gameData?.host);
        },
        currentUser() {
            return store.getters.currentUser;
        },
        gameData() {
            return store.getters.game;
        },
        isHost() {
            return this.currentUser?.email === this.gameData?.host;
        },
    },
    methods: {
        updateHeight(heightProp) {
            return this[heightProp] = this[heightProp] === 0 ? 'auto' : 0;
        },
        async addPlayerToGame(gameId, user) {
            const playerRef = doc(db, "games", gameId, "players", user.uid);
            const docSnap = await getDoc(playerRef);
            if (!docSnap.exists()) {
                await setDoc(playerRef, {
                    name: user.displayName,
                    email: user.email,
                    joinedAt: serverTimestamp(),
                    ready: false,
                    score: 0,
                    assignedCards: []
                });
            }
        },
        async kickPlayer(playerId) {
            const playerRef = doc(db, "games", this.gameId, "players", playerId);
            try {
                await deleteDoc(playerRef);
            } catch (error) {
                console.error("Error al eliminar jugador:", error);
            }
        },
        async updateAvatar(playerId, avatar) {
            const playerRef = doc(db, "games", this.gameId, "players", playerId);
            try {
                await setDoc(playerRef, { avatar }, { merge: true });
            } catch (error) {
                notify({
                    title: "Error del avatar",
                    text: "No se pudo actualizar el avatar: " + error.message,
                    type: "error",
                });
            }
        },
        async toggleReady() {
            const playerRef = doc(db, "games", this.gameId, "players", this.currentUser.uid);
            try {
                const docSnap = await getDoc(playerRef);
                if (docSnap.exists()) {
                    const currentReadyState = docSnap.data().ready;
                    await setDoc(playerRef, { ready: !currentReadyState }, { merge: true });

                    switch (!currentReadyState) {
                        case true:
                            notify({
                                title: "Estado de partida",
                                text: "Todo listo para jugar!",
                                type: "info",
                            });
                            break;
                        case false:
                            notify({
                                title: "Estado de partida",
                                text: "Volviste a prepararte...",
                                type: "info",
                            });
                            break;
                    }
                }
            } catch (error) {
                console.error("Error al cambiar el estado de listo:", error);
            }
        },
        async startGame() {
            try {
                await store.dispatch('distributeCardsToPlayers');
                await store.dispatch('getAssignedCards', {
                    gameId: this.gameId,
                    playerId: this.currentUser.uid,
                });

                const gameRef = doc(db, "games", this.gameId);
                await updateDoc(gameRef, { status: 'playing' });

            } catch (error) {
                return notify({
                    title: "Error al iniciar la partida",
                    text: "No se pudo iniciar la partida: " + error.message,
                    type: "error",
                });
            }
        }
    },
    watch: {
        gameId: {
            immediate: true,
            async handler(newCode) {
                if (newCode) {
                    await store.dispatch("startLobbyListeners", newCode);
                }
            }
        },
        gameData(newGame) {
            if (newGame?.status === 'playing') {
                store.dispatch('stopLobbyListeners', {
                    shouldRemovePlayer: false,
                    shouldResetLobby: false
                });
                router.push({ name: 'MainGame', params: { gameId: this.gameId } });
            }
        },
        gamePlayers(players) {
            if (!this.gameData || this.gameData.status !== 'waiting') return;

            const stillInLobby = players.some(p => p.email === this.currentUser.email);
            if (!stillInLobby && this.gameData?.status === "waiting") {
                notify({
                    title: "Estado de partida",
                    text: "Fuiste removido de la sala por el host o porque se cerró.",
                    type: "warning",
                });
                router.push("/");
            }
        }
    },
    async created() {
        await this.addPlayerToGame(this.gameId, this.currentUser);
        if (this.isHost) {
            await store.dispatch('getCards');
        }
    },
    beforeUnmount() {
        const isTransitioningToGame = this.gameData?.status === 'playing';

        store.dispatch("stopLobbyListeners", {
            shouldRemovePlayer: !isTransitioningToGame,
            shouldResetLobby: !isTransitioningToGame
        });
    }


};
</script>

<style scoped>
.players-list {
    width: 100%;
    max-height: 350px;
    overflow-y: auto;
    padding: 12px;
    border-radius: 8px;
    background-color: #ccb7b776;
}

#qrButton {
    margin: 0 auto;
    font-size: 13px;
    cursor: pointer;
    width: 40%;
}

.game-qr {
    margin: 0 auto;
    width: 152px;
    height: 152px;
    padding: 8px;
    border-radius: 8px;
    background-color: #b7a5a576;
}

.listed-player {
    position: relative;
    font-size: 18px;
    margin: 4px 0;
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
    padding: 8px;
    transition: background-color 0.3s ease;
    background-color: #4d4a4a76;
}

.listed-player.host .listed-player-name {
    font-weight: bold;
    color: #ffd700;
}

.listed-player.you .listed-player-name {
    font-weight: bold;
    color: #42b883;
}

.listed-player-avatar,
.avatar-select {
    font-size: 40px;
    width: 80px;
    height: 60px;
}

.avatar-select {
    border-radius: 4px;
    background-color: transparent;
    border: none;
    padding: 0;
}

.listed-player-status {
    text-align: left;
    font-size: 13px;
}

.listed-player-ishost,
.listed-player-isyou {
    font-size: 14px;
    color: black;
    padding: 3px 5px;
    border-radius: 4px;
}

.listed-player-ishost {
    background-color: #ffd700;
}

.listed-player-isyou {
    background-color: #42b883;
}

.kick-button,
.ready-button {
    font-size: 24px;
    position: absolute;
    right: 0;
    top: 0;
    border: none;
    cursor: pointer;
    background: transparent;
}

.start-button.disabled {
    background-color: #aea2a2;
    cursor: not-allowed;
    pointer-events: none;
}
</style>