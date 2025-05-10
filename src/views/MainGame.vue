<script setup>
import store from '../store';
import 'vue3-carousel/carousel.css';
import { Carousel, Slide, Pagination, Navigation } from 'vue3-carousel';
</script>

<template>
    <TransitionGroup name="fade" mode="out-in" appear>
        <div v-if="cardsList.length" class="flex vertical y-centered wide">
            <p class="matched-cards large-bottom-margin">Tarjetas emparejadas: <span class="bold">{{
                    successfullyPairedCards }}/{{ totalCards }}</span></p>
            <Carousel v-bind="carouselConfig" ref="cardsCarousel" class="wide large-top-margin large-bottom-margin">
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

            <div class="flex vertical y-centered wide">
                <h3>Ofrecer emparejamiento</h3>
                <label class="flex vertical y-centered">
                    Oponente:
                    <select class="small-top-margin" v-model="selectedOpponent" @change="offerPairing">
                        <option v-for="opponent in gamePlayers.filter(player => player.id !== currentUser.uid)"
                            :key="opponent.id" :value="opponent.id">
                            {{ opponent.name }} ({{ opponent.email }})
                        </option>
                    </select>
                </label>
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
    </TransitionGroup>
</template>

<script>
export default {
    name: 'MainGame',
    props: ['gameId'],
    data() {
        return {
            carouselConfig: {
                itemsToShow: 1.6,
                wrapAround: true,
                mouseWheel: true
            },
            loadingCards: true,
            selectedOpponent: null,
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
        totalCards() {
            return this.gameData.cardsPerPlayer.easy +
                this.gameData.cardsPerPlayer.normal +
                this.gameData.cardsPerPlayer.hard;
        },
        successfullyPairedCards() {
            return this.cardsList.filter(card => card.successfullyPaired).length;
        },
        isHost() {
            return this.currentUser?.email === this.gameData?.host;
        },
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
    },
    async mounted() {
        if (!this.gameData) {
            await store.dispatch('startLobbyListeners', this.gameId);
        }
    }


};
</script>

<style scoped>
.main-game {
    text-align: center;
    font-family: Arial, sans-serif;
}

.matched-cards {
    font-size: 20px;
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
    margin: 0 12px;
    opacity: 1;
}

.carousel__slide.paired {
    background-color: #92928e;
    opacity: 0.5;
}

.carousel__slide .card-image {
    margin: auto;
    padding: 0 10px;
    border-radius: 10px;
    max-height: 18vh;
    max-width: 220px;
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
</style>