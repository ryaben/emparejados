<script setup>
import store from '../store';
import 'vue3-carousel/carousel.css';
import { Carousel, Slide, Pagination, Navigation } from 'vue3-carousel';
</script>

<template>
    <div class="main-game">
        <h1>Welcome to Main Game</h1>
    </div>

    <Carousel v-bind="carouselConfig">
        <Slide v-for="card in cardsList" :key="i">
            <div class="carousel__item">
                <h3>Category: {{ card.category }}</h3>
                <p v-if="card.contentType === 'text'">{{ card.content }}</p>
                <img v-if="card.contentType === 'image'" width="256" :src="card.content" alt="Card Image" />
                <p>Código: {{ card.cardCode }}</p>
            </div>
        </Slide>

        <template #addons>
            <Navigation />
        </template>
    </Carousel>
</template>

<script>
export default {
    name: 'MainGame',
    data() {
        return {
            carouselConfig: {
                itemsToShow: 2,
                wrapAround: true,
                mouseWheel: true
            }
        };
    },
    computed: {
        cardsList() {
            return store.getters.cards;
        },
    },
    async beforeMount() {
        await store.dispatch('getCards');
    }
};
</script>

<style scoped>
.main-game {
    text-align: center;
    font-family: Arial, sans-serif;
}
</style>