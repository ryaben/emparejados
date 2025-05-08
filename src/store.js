import { createStore } from 'vuex';
import { doc, collection, query, where, getDocs, getDoc, onSnapshot, deleteDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase/init.js';

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function omit(obj, keyToOmit) {
    const { [keyToOmit]: omitted, ...rest } = obj;
    return rest;
}

function chunk(array, size) {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

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
        async getAssignedCards({ commit }, { gameId, playerId }) {
            try {
                const playerRef = doc(db, "games", gameId, "players", playerId);
                const playerSnap = await getDoc(playerRef);

                if (!playerSnap.exists()) {
                    console.warn("Jugador no encontrado en getAssignedCards");
                    return;
                }

                const assignedCardIds = playerSnap.data().assignedCards || [];
                const fullCardIds = assignedCardIds.flatMap(id => {
                    const baseId = id.replace(/_[01]$/, "");
                    return [`${baseId}_0`, `${baseId}_1`];
                });

                if (!fullCardIds.length) {
                    commit("setCards", []);
                    return;
                }

                // Eliminar sufijos _0 o _1 para obtener los IDs base
                const baseIds = [...new Set(assignedCardIds.map(id => id.replace(/_[01]$/, '')))];
                const cardDocs = [];

                // Firebase admite hasta 10 elementos en "in"
                const chunks = (arr, size) => arr.length <= size ? [arr] :
                    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

                const idChunks = chunks(baseIds, 10);
                const assignedSet = new Set(assignedCardIds);

                for (const chunk of idChunks) {
                    const q = query(collection(db, "cards"), where("__name__", "in", chunk));
                    const snapshot = await getDocs(q);

                    snapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        if (!data.options) return;

                        data.options.forEach((option, index) => {
                            const fullId = docSnap.id + "_" + index;
                            if (fullCardIds.includes(fullId)) {
                                cardDocs.push({
                                    id: fullId,
                                    content: option.content,
                                    contentType: option.contentType,
                                    cardCode: option.cardCode,
                                    isVisible: assignedSet.has(fullId),
                                    ...omit(data, 'options'),
                                });
                            }
                        });
                    });
                }

                commit("setCards", cardDocs);

            } catch (error) {
                console.error("Error al obtener assignedCards:", error);
            }
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
        stopLobbyListeners({ state, commit }, { shouldRemovePlayer = true, shouldResetLobby = true } = {}) {
            commit("clearUnsubscribers");

            try {
                const user = state.user;
                const game = state.game;

                if (user && game?.id && shouldRemovePlayer) {
                    const playerRef = doc(db, "games", game.id, "players", user.uid);
                    deleteDoc(playerRef)
                        .then(() => console.log(`Jugador ${user.uid} eliminado del juego ${game.id}`))
                        .catch((error) => console.error("Error al eliminar jugador:", error));
                }
            } catch (err) {
                console.error("Error en stopLobbyListeners:", err);
            }

            if (shouldResetLobby) {
                commit("resetLobby");
            }
        },
        async distributeCardsToPlayers({ getters, state }) {
            const players = [...getters.players];
            const game = getters.game;
            const { cardsPerPlayer } = game;
            const totalPlayers = players.length;

            // Agrupar las tarjetas por pareja y dificultad
            const pairsByDifficulty = { easy: [], normal: [], hard: [] };
            const pairsMap = {};

            state.cards.forEach(card => {
                const [baseId] = card.id.split('_');
                if (!pairsMap[baseId]) {
                    pairsMap[baseId] = [];
                }
                pairsMap[baseId].push(card);
            });

            // Filtrar solo los pares válidos (2 tarjetas)
            Object.values(pairsMap).forEach(pair => {
                if (pair.length === 2) {
                    const difficulty = pair[0].difficulty;
                    if (pairsByDifficulty[difficulty]) {
                        pairsByDifficulty[difficulty].push(pair);
                    }
                }
            });

            // Mezclar los pares por dificultad
            for (const difficulty in pairsByDifficulty) {
                pairsByDifficulty[difficulty] = shuffle(pairsByDifficulty[difficulty]);
            }

            // Preparar estructura de asignación
            const assignments = {};
            players.forEach(p => (assignments[p.id] = []));

            // Asignar pares por dificultad
            for (const difficulty of ["easy", "normal", "hard"]) {
                const pairsNeeded = Math.ceil((totalPlayers * cardsPerPlayer[difficulty]) / 2);
                const availablePairs = pairsByDifficulty[difficulty].slice(0, pairsNeeded);

                for (const pair of availablePairs) {
                    const eligiblePlayers = players.filter(p =>
                        assignments[p.id].filter(c => c.difficulty === difficulty).length < cardsPerPlayer[difficulty]
                    );

                    if (eligiblePlayers.length < 2) continue;

                    const shuffled = shuffle(eligiblePlayers);
                    const playerA = shuffled[0];
                    const playerB = shuffled[1];

                    assignments[playerA.id].push(pair[0]);
                    assignments[playerB.id].push(pair[1]);
                }
            }

            // Guardar solo los IDs en Firebase
            const batch = players.map(player => {
                const ref = doc(db, "games", game.id, "players", player.id);
                const shuffledCardIds = shuffle(assignments[player.id].map(card => card.id));
                return updateDoc(ref, {
                    assignedCards: shuffledCardIds
                });
            });

            await Promise.all(batch);
        }
    }
});

export default store;