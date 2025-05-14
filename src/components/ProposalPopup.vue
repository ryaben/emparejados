<script setup>
import store from '../store';

defineProps({
    open: {
        type: Boolean,
        default: false,
    },
    proposalData: {
        type: Object,
        default: () => ({ proposer: null, proposerCard: null, receiverCard: null, gameId: null, proposalId: null }),
    },
});
</script>

<template>
    <TransitionGroup name="fade" mode="out-in" appear>
        <div v-if="open" class="popup-overlay"></div>
        <div v-if="open" class="proposal-popup flex vertical space-between">
            <h3>Propuesta de emparejamiento</h3>
            <p class="zero-top-margin medium-bottom-margin">
                <span class="bold">{{ proposerName }}</span> te ha propuesto emparejar tu tarjeta de código <span
                    class="bold">{{
                        proposalData.receiverCard }}</span> con su tarjeta de código <span class="bold">{{
                        proposalData.proposerCard
                    }}</span>.
            </p>
            <div class="flex space-between">
                <button class="main-button short alert-text"
                    @click="respondToMatchProposal(proposalData.gameId, proposalData.proposalId, false)">Rechazar</button>
                <button class="main-button short success-text"
                    @click="respondToMatchProposal(proposalData.gameId, proposalData.proposalId, true)">Aceptar</button>
            </div>
        </div>
    </TransitionGroup>
</template>

<script>
export default {
    name: "ProposalPopup",
    emits: ["close"],
    data() {
        return {

        };
    },
    computed: {
        gamePlayers() {
            return store.getters.players;
        },
        proposerName() {
            return this.gamePlayers.find(player => player.id === this.proposalData.proposer)?.name;
        },
    },
    methods: {
        respondToMatchProposal(gameId, proposalId, decision) {
            store.dispatch('respondToMatchProposal', { gameId: gameId, proposalId: proposalId, accept: decision });
            this.$emit('close');
        }
    }
};
</script>

<style scoped>
.proposal-popup {
    position: fixed;
    left: calc(50% - 30vw - 11px);
    top: 25px;
    border: 1px inset #ccc;
    padding: 10px;
    border-radius: 8px;
    width: 60vw;
    text-align: center;
    background: linear-gradient(to bottom, #242424, #b0a9a9);
    z-index: 4;
}

.popup-overlay {
    position: fixed;
    top: 0px;
    left: 0px;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 3;
}

.main-button.short {
    width: 50%;
    max-width: 200px;
    margin: 0 5px;
}
</style>