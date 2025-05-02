import { createStore } from 'vuex';
import { doc, collection, query, getDocs, onSnapshot, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase/init.js';

const store = createStore({
    state: {
        cards: [],
        user: null,
        game: null,
        players: [],
        unsubscribers: {
            game: null,
            players: null
        }
    },
    getters: {
        cards(state) {
            return state.cards;
        },
        game(state) {
            return state.game;
        },
        players(state) {
            return state.players;
        },
        isLoggedIn: (state) => !!state.user,
        currentUser: (state) => state.user,
    },
    mutations: {
        setCards(state, value) {
            state.cards = value;
        },
        setGame(state, gameData) {
            state.game = gameData;
        },
        setPlayers(state, players) {
            state.players = players;
        },
        setUser(state, user) {
            state.user = user;
        },
        setUnsubscribers(state, { gameUnsub, playersUnsub }) {
            state.unsubscribers.game = gameUnsub;
            state.unsubscribers.players = playersUnsub;
        },
        clearUnsubscribers(state) {
            if (state.unsubscribers.game) state.unsubscribers.game();
            if (state.unsubscribers.players) state.unsubscribers.players();
            state.unsubscribers = { game: null, players: null };
        },
        resetLobby(state) {
            state.game = null;
            state.players = [];
        }
    },
    actions: {
        async getCards(context) {
            function omit(obj, keyToOmit) {
                const { [keyToOmit]: omitted, ...rest } = obj;
                return rest;
            }

            const q = query(collection(db, "cards"));
            let cardsList = [];

            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                doc.data().options.forEach((option, index) => {
                    cardsList.push({ id: doc.id + '_' + index, content: option.content, contentType: option.contentType, cardCode: option.cardCode, ...omit(doc.data(), 'options') });
                });
            });

            context.commit('setCards', cardsList);
        },
        startLobbyListeners({ commit }, gameCode) {
            const gameRef = doc(db, "games", gameCode);
            const playersRef = collection(db, "games", gameCode, "players");

            // Listener del documento del juego
            const gameUnsub = onSnapshot(gameRef, (docSnap) => {
                if (docSnap.exists()) {
                    commit("setGame", { id: docSnap.id, ...docSnap.data() });
                }
            });

            // Listener de la subcolección de jugadores
            const playersUnsub = onSnapshot(playersRef, (snapshot) => {
                const players = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                commit("setPlayers", players);
            });

            commit("setUnsubscribers", { gameUnsub, playersUnsub });
        },
        initAuth({ commit }) {
            onAuthStateChanged(auth, (user) => {
                commit('setUser', user);
            });
        },
        stopLobbyListeners({ state, commit }) {
            commit("clearUnsubscribers");

            try {
                const user = state.user;
                const game = state.game;

                if (user && game?.id) {
                    const playerRef = doc(db, "games", game.id, "players", user.uid);
                    deleteDoc(playerRef)
                        .then(() => console.log(`Jugador ${user.uid} eliminado del juego ${game.id}`))
                        .catch((error) => console.error("Error al eliminar jugador:", error));
                }
            } catch (err) {
                console.error("Error en stopLobbyListeners:", err);
            }

            commit("resetLobby");
        }
    }
});

// export the store
export default store;