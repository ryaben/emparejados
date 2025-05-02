<script setup>
import router from '../router/index';
import store from '../store';
import VueQrcode from 'vue-qrcode';
import AnimateHeight from 'vue-animate-height';
import { db } from '../firebase/init.js';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { notify } from '@kyvg/vue3-notification';

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

                <h3 class="medium-bottom-margin">Jugadores en la sala ({{ gamePlayers.length }})</h3>
                <p v-if="!hasHost && gamePlayers.length > 0" class="alert-text bold small-top-margin">
                    El creador de la partida no está presente.
                </p>
                <TransitionGroup class="players-list flex vertical x-centered small-bottom-margin"
                    v-if="gamePlayers.length > 0" name="fade" tag="div">

                    <div class="listed-player flex left y-centered"
                        :class="{ 'host': player.email === gameData?.host, 'you': currentUser.email === player.email }"
                        v-for="(player, index) in gamePlayers" :key="index">
                        <span class="listed-player-avatar large-right-margin">🧙‍♂️</span>
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
                            <span class="listed-player-status" :class="{ 'success-text': player.ready }">{{ player.ready
                                ? 'Listo/a' : 'Preparándose' }}</span>
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
                <button v-if="isHost" class="container-button main-button medium-top-margin" @click="startGame">Iniciar
                    partida</button>
            </div>
        </div>

        <button class="container-button main-button medium-top-margin">
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
            qrHeight: 0
        };
    },
    computed: {
        gamePlayers() {
            return store.getters.players;
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
        gamePlayers(players) {
            const stillInLobby = players.some(p => p.email === this.currentUser.email);
            if (!stillInLobby) {
                notify({
                    title: "Estado de partida",
                    text: "Fuiste removido de la sala por el host.",
                    type: "warning",
                });
                router.push("/");
            }
        }
    },
    async created() {
        await this.addPlayerToGame(this.gameId, this.currentUser);
    },
    beforeUnmount() {
        store.dispatch("stopLobbyListeners");
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

.listed-player-avatar {
    font-size: 40px;
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
</style>