import { createStore } from 'vuex';
import { doc, collection, query, where, getDocs, addDoc, getDoc, onSnapshot, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase/init.js';

// Global variables:
const pointsPerDifficulty = {
    easy: 1,
    normal: 3,
    hard: 5
};
const pointPenalization = 2;

var unsubscribeAssignedCards = null; // Fuera del action, o en un módulo adecuado

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
        proposals: [],
        unsubscribers: {
            game: null,
            players: null,
            proposals: null
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
        proposals(state) {
            return state.proposals;
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
        setProposals(state, proposals) {
            state.proposals = proposals;
        },
        setUser(state, user) {
            state.user = user;
        },
        setUnsubscribers(state, { gameUnsub, playersUnsub, proposalsUnsub }) {
            state.unsubscribers.game = gameUnsub;
            state.unsubscribers.players = playersUnsub;
            state.unsubscribers.proposals = proposalsUnsub;
        },
        clearUnsubscribers(state) {
            if (state.unsubscribers.game) state.unsubscribers.game();
            if (state.unsubscribers.players) state.unsubscribers.players();
            if (state.unsubscribers.proposals) state.unsubscribers.proposals();
            state.unsubscribers = { game: null, players: null, proposals: null };
        },
        resetLobby(state) {
            state.game = null;
            state.players = [];
            state.proposals = [];
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

                // Detener cualquier escucha previa
                if (unsubscribeAssignedCards) unsubscribeAssignedCards();

                unsubscribeAssignedCards = onSnapshot(playerRef, async (playerSnap) => {
                    if (!playerSnap.exists()) {
                        console.warn("Jugador no encontrado en getAssignedCards");
                        commit("setCards", []);
                        return;
                    }

                    const assignedCardObjs = playerSnap.data().assignedCards || [];
                    const assignedCardIds = assignedCardObjs.map(card => card.id);
                    const fullCardIds = assignedCardIds.flatMap(id => {
                        const baseId = id.replace(/_[01]$/, "");
                        return [`${baseId}_0`, `${baseId}_1`];
                    });
                    const pairedMap = Object.fromEntries(assignedCardObjs.map(card => [card.id, card.successfullyPaired]));

                    if (!fullCardIds.length) {
                        commit("setCards", []);
                        return;
                    }

                    const baseIds = [...new Set(assignedCardIds.map(id => id.replace(/_[01]$/, '')))];
                    const cardDocs = [];
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
                                        successfullyPaired: pairedMap[fullId] ?? false,
                                        ...omit(data, 'options'),
                                    });
                                }
                            });
                        });
                    }

                    commit("setCards", cardDocs);
                });
            } catch (error) {
                console.error("Error al obtener assignedCards:", error);
            }
        },
        startLobbyListeners({ commit }, gameCode) {
            const gameRef = doc(db, "games", gameCode);
            const playersRef = collection(db, "games", gameCode, "players");
            const proposalsRef = collection(db, "games", gameCode, "proposedMatches");

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

            // Listener de la subcolección de propuestas de emparejamiento
            const proposalsUnsub = onSnapshot(proposalsRef, (snapshot) => {
                const proposals = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                commit("setProposals", proposals);
            });

            commit("setUnsubscribers", { gameUnsub, playersUnsub, proposalsUnsub });
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
                    assignedCards: shuffledCardIds.map(id => ({ id, successfullyPaired: false }))
                });
            });

            await Promise.all(batch);
        },
        async proposeCardMatch({ commit }, { gameId, playerId, rivalPlayerId, myCardId, guessedCode }) {
            try {
                const matchRef = collection(db, "games", gameId, "proposedMatches");

                await addDoc(matchRef, {
                    proposerId: playerId,
                    rivalPlayerId,
                    myCardId,
                    guessedCode,
                    status: "pending", // "correct" | "wrong" | "rejected"
                    createdAt: serverTimestamp()
                });
            } catch (err) {
                console.error("Error al crear la propuesta de emparejamiento:", err);
            }
        },
        async respondToMatchProposal({ state }, { gameId, proposalId, accept }) {
            try {
                const proposalRef = doc(db, "games", gameId, "proposedMatches", proposalId);
                const proposalSnap = await getDoc(proposalRef);

                if (!proposalSnap.exists()) {
                    return { success: false, reason: "proposal_not_found" };
                }

                const proposal = proposalSnap.data();

                // Si se rechaza, solo se marca como tal
                if (!accept) {
                    await updateDoc(proposalRef, { status: "rejected" });
                    return { success: true, result: "rejected" };
                }

                // Validación: buscar complementaria en cards del store
                const allCards = state.cards;
                const thisCard = allCards.find(card => card.cardCode === proposal.myCardId);
                const baseId = thisCard.id.replace(/_[01]$/, "");
                const complementId = thisCard.id.endsWith("_0") ? `${baseId}_1` : `${baseId}_0`;
                const complementCard = allCards.find(card => card.id === complementId);

                const userRefs = [
                    doc(db, "games", gameId, "players", proposal.proposerId),
                    doc(db, "games", gameId, "players", proposal.rivalPlayerId)
                ];

                if (!complementCard) {
                    return { success: false, reason: "complement_not_found" };
                }

                const isCorrect = complementCard.cardCode === proposal.guessedCode;

                // Actualizar status
                await updateDoc(proposalRef, {
                    status: isCorrect ? "correct" : "wrong"
                });
                if (!isCorrect) {
                    userRefs.forEach(async (userRef) => {
                        const userSnap = await getDoc(userRef);
                        if (!userSnap.exists()) return;

                        const currentScore = userSnap.data().score || 0;
                        await updateDoc(userRef, {
                            score: currentScore - pointPenalization
                        });
                    });
                    return { success: true, result: "wrong" };
                }

                const thisCardDifficulty = thisCard ? thisCard.difficulty : null;

                let newScore = 0;
                switch (thisCardDifficulty) {
                    case 'easy':
                        newScore = pointsPerDifficulty.easy;
                        break;
                    case 'normal':
                        newScore = pointsPerDifficulty.normal;
                        break;
                    case 'hard':
                        newScore = pointsPerDifficulty.hard;
                        break;
                    default:
                        break;
                }

                // Marcar como successfullyPaired en assignedCards del proposer y receiver
                userRefs.forEach(async (userRef) => {
                    const userSnap = await getDoc(userRef);
                    if (!userSnap.exists()) return;

                    const assignedCards = userSnap.data().assignedCards || [];
                    const updatedAssignedCards = assignedCards.map(card =>
                        card.id === thisCard.id || card.id === complementCard.id ? { ...card, successfullyPaired: true } : card
                    );

                    await updateDoc(userRef, {
                        assignedCards: updatedAssignedCards,
                        score: (userSnap.data().score || 0) + newScore
                    });
                });

                return { success: true, result: "accepted" };

            } catch (err) {
                console.error("Error al responder propuesta:", err);
                return { success: false, reason: "internal_error" };
            }
        }
    }
});

export default store;