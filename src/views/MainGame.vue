<script setup>
import store from '../store';
import 'vue3-carousel/carousel.css';
import { Carousel, Slide, Pagination, Navigation } from 'vue3-carousel';
import ProposalPopup from '../components/ProposalPopup.vue';
import { notify } from '@kyvg/vue3-notification';
</script>

<template>
    <TransitionGroup id="mainGame" name="fade" mode="out-in" appear>
        <div v-if="cardsList.length" class="flex vertical y-centered wide">
            <div class="score-container flex space-evenly wide">
                <p class="matched-cards">
                    Tiempo<br>
                    <Transition name="fade" mode="out-in">
                        <span :key="gameTimeLeft" class="bold game-figure">{{
                            gameTimeLeft }}</span>
                    </Transition>
                </p>
                <p class="matched-cards large-bottom-margin">
                    Tarjetas<br>
                    <Transition name="fade" mode="out-in">
                        <span :key="successfullyPairedCards.length" class="bold game-figure"><span
                                class="success-text">{{ successfullyPairedCards.length
                                }}</span>/{{ totalCards }}</span>
                    </Transition>
                </p>
                <p class="matched-cards">
                    Puntos<br>
                    <Transition name="fade" mode="out-in">
                        <span :key="thisPlayer.score" class="bold game-figure">{{
                            thisPlayer.score || 0 }}</span>
                    </Transition>
                </p>
            </div>
            <Carousel v-bind="carouselConfig" v-model="activeCarouselIndex"
                class="wide large-top-margin large-bottom-margin">
                <Slide class="medium-left-margin medium-right-margin" v-for="card in cardsList.filter(c => c.isVisible)"
                    :key="card.id" :class="{ 'paired': card.successfullyPaired }">
                    <div class="carousel__item flex vertical space-between wide tall">
                        <h3 class="card-category small-top-margin large-bottom-margin">{{ card.category }}</h3>
                        <p class="card-text" v-if="card.contentType === 'text'">{{ card.content }}</p>
                        <img class="card-image wide tall" v-if="card.contentType === 'image'" width="256"
                            :src="card.content" alt="Card Image" />
                        <p class="card-code large-top-margin small-bottom-margin">Código: <span class="bold">{{
                            card.cardCode }}</span></p>
                    </div>
                </Slide>

                <template #addons>
                    <Navigation />
                </template>
            </Carousel>

            <div class="pairing-container flex vertical y-centered wide">
                <h3>Ofrecer emparejamiento</h3>
                <label class="small-top-margin medium-bottom-margin wide">Mi tarjeta activa (<span class="bold">{{
                    currentCard.cardCode }}</span>)
                    con...</label>
                <label class="flex vertical y-centered small-top-margin medium-bottom-margin wide">
                    Nombre de rival:
                    <select class="main-input" v-model="selectedOpponent" :style="{ width: '75%' }">
                        <option v-for="opponent in gamePlayers.filter(player => player.id !== currentUser.uid)"
                            :key="opponent.id" :value="opponent.id">
                            {{ opponent.avatar }} {{ opponent.name }}
                        </option>
                    </select>
                </label>
                <label class="flex vertical y-centered small-top-margin large-bottom-margin wide">
                    Código de tarjeta rival:
                    <input type="text" class="main-input half-wide" v-model="pairingCode" />
                </label>
                <button class="main-button medium-top-margin" :class="{ 'disabled': currentCard?.successfullyPaired }"
                    @click="offerPairing">Enviar</button>
            </div>
        </div>

        <div v-else-if="loadingCards" class="loading flex vertical y-centered wide large-bottom-margin">
            <img width="64" src="/img/loading.gif" alt="Cargando..." style="background: transparent;" />
            <span>Cargando interfaz...</span>
        </div>

        <div v-else-if="!loadingCards && (!cardsList.length || !cardsList)">
            <p style="font-size: 18px;">Tu usuario no forma parte de esta partida en curso.</p>
            <button class="container-button main-button medium-top-margin large-bottom-margin">
                <router-link to="/" class="block">Volver al menú</router-link>
            </button>
        </div>

        <ProposalPopup class="proposal-popup" :open="popupDisplay" @close="popupDisplay = false"
            :proposal-data="proposalData" />
    </TransitionGroup>
</template>

<script>
export default {
    name: 'MainGame',
    props: ['gameId'],
    components: {
        ProposalPopup
    },
    data() {
        return {
            carouselConfig: {
                itemsToShow: 1.5,
                wrapAround: true,
                mouseWheel: true
            },
            loadingCards: true,
            selectedOpponent: null,
            popupDisplay: false,
            pairingCode: '',
            proposalData: {
                proposer: null,
                proposerCard: null,
                receiverCard: null,
                gameId: null,
                proposalId: null
            },
            activeCarouselIndex: 0,
            currentTime: Date.now(),
            intervalId: null,
        };
    },
    computed: {
        cardsList() {
            return store.getters.cards;
        },
        currentUser() {
            return store.getters.currentUser;
        },
        gameData() {
            return store.getters.game;
        },
        gamePlayers() {
            return store.getters.players;
        },
        thisPlayer() {
            return this.gamePlayers.find(player => player.id === this.currentUser.uid);
        },
        totalCards() {
            return this.gameData.cardsPerPlayer.easy +
                this.gameData.cardsPerPlayer.normal +
                this.gameData.cardsPerPlayer.hard;
        },
        successfullyPairedCards() {
            return this.cardsList.filter(card => card.successfullyPaired);
        },
        currentPlayerProposals() {
            return store.getters.proposals.filter(proposal => proposal.rivalPlayerId === this.currentUser.uid && proposal.status === 'pending');
        },
        currentCard() {
            return this.cardsList.filter(c => c.isVisible)[this.activeCarouselIndex];
        },
        isHost() {
            return this.currentUser?.email === this.gameData?.host;
        },
        gameTimeLeft() {
            if (!this.gameData?.startedAt || !this.gameData?.gameDuration) return null;

            const start = new Date(this.gameData.startedAt.seconds * 1000);
            const elapsed = Math.floor((this.currentTime - start.getTime()) / 1000);
            return Math.max(this.gameData.gameDuration - elapsed, 0);
        },
    },
    methods: {
        async offerPairing() {
            if (!this.selectedOpponent) return notify({
                type: 'error',
                title: 'Error al emparejar',
                text: 'Debes seleccionar un oponente al cual hacerle el ofrecimiento.',
            });

            const opponent = this.gamePlayers.find(player => player.id === this.selectedOpponent);
            if (!opponent) return notify({
                type: 'error',
                title: 'Error al emparejar',
                text: 'Oponente no encontrado en la partida.',
            });

            await store.dispatch('proposeCardMatch', {
                gameId: this.gameId,
                playerId: this.currentUser.uid,
                rivalPlayerId: opponent.id,
                myCardId: this.currentCard.cardCode,
                guessedCode: this.pairingCode,
            });

            notify({
                type: 'warning',
                title: 'Emparejamiento enviado',
                text: `Has ofrecido un emparejamiento de tarjetas a ${opponent.name}!`,
            });
            this.pairingCode = '';
        }
    },
    watch: {
        gameData: {
            immediate: true,
            async handler(newVal) {
                if (!newVal || !this.currentUser?.uid) return;

                // Disparar acción solo si aún no hay tarjetas
                if (!this.cardsList || this.cardsList.length === 0) {
                    await store.dispatch('getAssignedCards', {
                        gameId: this.gameId,
                        playerId: this.currentUser.uid,
                    });
                    this.loadingCards = false;
                }
            },
        },
        currentPlayerProposals: {
            immediate: true,
            handler(newVal) {
                if (newVal.length > 0) {
                    this.proposalData = {
                        proposer: newVal[0].proposerId,
                        proposerCard: newVal[0].myCardId,
                        receiverCard: newVal[0].guessedCode,
                        gameId: this.gameId,
                        proposalId: newVal[0].id,
                    }
                    this.popupDisplay = true;
                }
            },
        },
    },
    async mounted() {
        if (!this.gameData || !this.gamePlayers || this.gamePlayers.length === 0) {
            await store.dispatch('startLobbyListeners', this.gameId);
        }

        this.intervalId = setInterval(() => {
            this.currentTime = Date.now();
        }, 1000);
    },
    beforeUnmount() {
        store.dispatch("stopLobbyListeners", {
            shouldRemovePlayer: !isTransitioningToGame,
            shouldResetLobby: !isTransitioningToGame
        });

        if (this.intervalId) clearInterval(this.intervalId);
    }
};
</script>

<style scoped>
.main-game {
    text-align: center;
    font-family: Arial, sans-serif;
}

.score-container {
    background: linear-gradient(to top, #242424, #168a42);
    border-radius: 8px;
    padding: 15px;
    text-align: center;
}

.matched-cards {
    font-size: 20px;
}

.game-figure {
    font-size: 30px;
}

.carousel__slide {
    background-color: #52e197;
    border-radius: 10px;
    opacity: 0.5;
    height: 30vh;
    min-height: 250px;
}

.carousel__slide--active {
    background-color: #168a42;
    border: 2px outset #d1ec1f;
    opacity: 1;
}

.carousel__slide--next {
    margin-left: 10px;
}

.carousel__slide--prev {
    margin-right: 10px;
}

.carousel__slide.paired {
    background-color: #92928e;
    opacity: 0.5;
}

.carousel__slide .card-image {
    margin: auto;
    padding: 0 10px;
    border-radius: 10px;
    max-height: 16vh;
    max-width: 250px;
    object-fit: contain;
    aspect-ratio: 1 / 1;
}

.carousel__slide .card-category {
    border-bottom: 2px solid #413f3b;
    padding-bottom: 5px;
}

.carousel__slide--active:not(.paired) .card-category {
    border-bottom: 2px solid #d1ec1f;
}

.carousel__slide .card-text {
    font-size: 20px;
    padding: 0 10px;
}

.carousel__slide .card-code {
    border-top: 2px solid #413f3b;
    padding-top: 5px;
}

.carousel__slide--active:not(.paired) .card-code {
    border-top: 2px solid #d1ec1f;
}

.pairing-container {
    background: linear-gradient(to bottom, #242424, #168a42);
    border-radius: 8px;
    padding: 15px;
    text-align: center;
}
</style>