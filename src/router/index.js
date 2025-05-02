import { createWebHistory, createRouter } from "vue-router";
import store from '../store';

//Views importadas
import Home from "/src/views/Home.vue";
import Lobby from "/src/views/Lobby.vue";
import MainGame from "/src/views/MainGame.vue";

//Rutas
const routes = [
  {
    path: "/",
    name: "Home",
    component: Home
  },
  {
    path: "/lobby/:gameId",
    name: "Lobby",
    component: Lobby,
    props: true
  },
  {
    path: "/game",
    name: "MainGame",
    component: MainGame
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const requiresAuth = to.meta.requiresAuth;
  const user = store.getters['auth/currentUser'];
  
  if (requiresAuth && !user) {
    next('/');
  } else {
    next();
  }
});

export default router;