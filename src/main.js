import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router';
import Notifications from '@kyvg/vue3-notification';
import store from './store';

store.dispatch('initAuth').then(() => {
    createApp(App).use(router).use(Notifications).mount('#app');
});
