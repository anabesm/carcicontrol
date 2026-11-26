import { createApp } from 'vue'
import { pinia } from './stores'

import App from './App.vue'
import router from './router'
import './assets/main.css'
import './assets/field.css'
import { initializePwa } from './pwa'

initializePwa()

const app = createApp(App)

app.use(pinia)
app.use(router)

app.mount('#app')
