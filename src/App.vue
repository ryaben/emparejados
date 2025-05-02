<script setup>
import { auth } from './firebase/init.js';
import { onAuthStateChanged } from 'firebase/auth';
</script>

<template>
  <main>
    <router-view v-slot="{ Component, route }">
      <KeepAlive :include="['MainGame']">
        <component :is="Component" :key="route.fullPath" />
      </KeepAlive>
    </router-view>
  </main>

  <notifications position="top center" width="350px" speed="700" :pause-on-hover="true" />
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      user: null,
    };
  },
  methods: {
    authListener() {
      onAuthStateChanged(auth, user => {
        if (user) {
          this.user = user;
        } else {
          this.user = {
            emailVerified: false
          }
        }
      });
    }
  },
  mounted() {
    this.authListener();
  },
};
</script>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
