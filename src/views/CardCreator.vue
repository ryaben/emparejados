<script setup>
import store from '../store';
import { db } from '../firebase/init.js';
import { addDoc, collection, doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { notify } from '@kyvg/vue3-notification';
import admins from '../assets/appVariables/admins.js';
import categories from '../assets/appVariables/categories.js';
</script>

<template>
    <h1>Creador de tarjetas</h1>
    
    <div v-if="!userIsAdmin" class="flex vertical y-centered">
        <p>Acceso denegado. Solo los administradores pueden crear tarjetas.</p>
        <button class="container-button main-button medium-top-margin large-bottom-margin">
            <router-link to="/" class="block">Volver al menú</router-link>
        </button>
    </div>

    <div v-if="userIsAdmin" class="card-creator flex x-centered">
        <form id="cardCreatorForm" @submit.prevent="createCard">
            <div>
                <label for="category">Categoría:</label>
                <select name="category" id="category" v-model="cardData.category" required>
                    <option v-for="(category, i) in categories.sort()" :value="category" :key="i">
                        {{ category }}
                    </option>
                </select>
            </div>
            <div>
                <label for="difficulty">Dificultad:</label>
                <select id="difficulty" v-model="cardData.difficulty" required>
                    <option value="easy">Fácil</option>
                    <option value="normal">Media</option>
                    <option value="hard">Difícil</option>
                </select>
            </div>
            <div>
                <label for="hint">Pista:</label>
                <input type="text" id="hint" v-model="cardData.hint" />
            </div>
            <div class="card-pair">
                <div class="card">
                    <h3>Tarjeta 1</h3>
                    <label for="card1-code">Código:</label>
                    <input type="text" id="card1-code" v-model="cardData.options[0].cardCode" required />
                    <label for="card1-content">Contenido:</label>
                    <input type="text" id="card1-content" v-model="cardData.options[0].content" required />
                    <label for="card1-type">Tipo de contenido:</label>
                    <select id="card1-type" v-model="cardData.options[0].contentType" required>
                        <option value="text">Texto</option>
                        <option value="image">Imagen</option>
                        <option value="audio">Audio</option>
                    </select>
                </div>
                <div class="card">
                    <h3>Tarjeta 2</h3>
                    <label for="card2-code">Código:</label>
                    <input type="text" id="card2-code" v-model="cardData.options[1].cardCode" required />
                    <label for="card2-content">Contenido:</label>
                    <input type="text" id="card2-content" v-model="cardData.options[1].content" required />
                    <label for="card2-type">Tipo de contenido:</label>
                    <select id="card2-type" v-model="cardData.options[1].contentType" required>
                        <option value="text">Texto</option>
                        <option value="image">Imagen</option>
                        <option value="audio">Audio</option>
                    </select>
                </div>
            </div>
            <div class="flex vertical y-centered">
                <img class="medium-bottom-margin" v-if="uploadingCard" width="32" src="/img/loading.gif"
                    alt="Loading..." style="background: transparent;" />
                <button type="submit">Crear tarjeta</button>
            </div>
        </form>
    </div>
</template>

<script>
export default {
    name: "CardCreator",
    data() {
        return {
            cardCodes: [],
            cardData: {
                category: categories[0],
                difficulty: "easy",
                hint: "",
                options: [
                    { cardCode: "", content: "", contentType: "text" },
                    { cardCode: "", content: "", contentType: "text" },
                ]
            },
            uploadingCard: false,
        };
    },
    computed: {
        currentUser() {
            return store.getters.currentUser;
        },
        userIsAdmin() {
            return admins.includes(this.currentUser.uid);
        }
    },
    methods: {
        async finishUpload() {
            await addDoc(collection(db, "cards"), this.cardData);
            await this.addCodes();
            this.resetForm();
            notify({
                title: 'Tarjeta creada',
                text: 'La tarjeta ha sido creada exitosamente.',
                type: 'success'
            });
            this.uploadingCard = false;
        },
        async createCard() {
            const that = this;

            try {
                if (this.checkCardCodes() === 'non-compliant') {
                    notify({
                        title: 'Error al crear tarjeta',
                        text: 'Algún código no cumple con el requisito de ser palabra válida de 6 letras.',
                        type: 'error'
                    });
                    return;
                }
                else if (this.checkCardCodes() === 'already-used') {
                    notify({
                        title: 'Error al crear tarjeta',
                        text: 'Algún código ya ha sido utilizado para otra tarjeta.',
                        type: 'error'
                    });
                    return;
                }

                const fileTypes = { image: ".jpg", audio: ".mp3" };

                let optionsProcessed = 0;

                for (const [index, card] of [this.cardData.options[0], this.cardData.options[1]].entries()) {
                    if (fileTypes[card.contentType]) {
                        // Manejo con archivo
                        that.uploadingCard = true;
                        await this.uploadCardFile(card.cardCode, card.contentType, index, fileTypes[card.contentType], async function (fileName) {
                            await that.generateFileReference(fileName, card.contentType, fileTypes[card.contentType], async function (url) {
                                that.cardData.options[index].content = url;
                                optionsProcessed++;
                                if (optionsProcessed === 2) {
                                    await that.finishUpload();
                                }
                            });
                        });
                    } else if (card.contentType === 'text' && card.content) {
                        // Manejo de contenido de texto
                        optionsProcessed++;
                        if (optionsProcessed === 2) {
                            this.uploadingCard = true;
                            await that.finishUpload();
                        }
                    }
                }
            } catch (error) {
                console.log(error);
                this.uploadingCard = false;
                return notify({
                    title: 'Error al crear tarjeta',
                    text: 'Hubo un error al crear la tarjeta: ' + error,
                    type: 'error'
                });
            }
        },
        async uploadCardFile(fileName, folder, cardNumber, fileExtension, callback) {
            const storage = getStorage();
            const storageRef = ref(storage, 'cards/' + folder + '/' + fileName + fileExtension);

            const response = await fetch(this.cardData.options[cardNumber].content);
            const blob = await response.blob();

            uploadBytes(storageRef, blob).then((snapshot) => {
                console.log('File uploaded with ID ' + fileName);
                callback(fileName);
            });
        },
        async generateFileReference(fileName, folder, fileExtension, callback) {
            const storage = getStorage();

            getDownloadURL(ref(storage, 'cards/' + folder + '/' + fileName + fileExtension))
                .then((url) => {
                    console.log('Reference link for ' + fileName + ' is: ' + url);
                    callback(url);
                })
                .catch((error) => {
                    notify({
                        title: "Error on getting direct link",
                        text: error,
                        type: "error"
                    });
                });
        },
        resetForm() {
            this.cardData.category = categories[0];
            this.cardData.difficulty = "easy";
            this.cardData.hint = "";
            this.cardData.options[0] = { cardCode: "", content: "", contentType: "text" };
            this.cardData.options[1] = { cardCode: "", content: "", contentType: "text" };
        },
        loadCodes() {
            const docRef = doc(db, 'codes', 'codes');

            this.unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    this.cardCodes = docSnap.data().cardCodes || [];
                }
            }, (error) => {
                console.error('Error en tiempo real:', error);
            });
        },
        checkCardCodes() {
            for (const option of this.cardData.options) {
                const optionWord = option.cardCode.trim().toLowerCase();

                if (optionWord.length !== 6 || !/^[a-záéíóúñüö]{6}$/i.test(optionWord)) {
                    return 'non-compliant';
                }

                if (this.cardCodes.includes(optionWord)) {
                    return 'already-used';
                }
            }

            return 'both-compliant';
        },
        async addCodes() {
            this.cardData.options.forEach(option => {
                const optionWord = option.cardCode.trim().toLowerCase();

                try {
                    const docRef = doc(db, 'codes', 'codes');
                    updateDoc(docRef, {
                        cardCodes: arrayUnion(optionWord)
                    });
                    this.cardCodes.push(optionWord);
                } catch (error) {
                    return notify({
                        title: 'Error',
                        text: 'Hubo un error con los códigos al agregar las tarjetas: ' + error,
                        type: 'error'
                    });
                }
            });
        }
    },
    mounted() {
        this.loadCodes();
    },
    beforeUnmount() {
        if (this.unsubscribe) this.unsubscribe();
    }
};
</script>

<style scoped>
.card-creator {
    padding: 20px;
    font-family: Arial, sans-serif;
}

.card-creator p {
    color: #666;
}

.card-creator form {
    text-align: center;
    max-width: 600px;
    margin: 0 auto;
    background-color: #f9f9f9;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-creator form div {
    margin-bottom: 10px;
    text-align: left;
}

.card-creator label {
    display: block;
    font-weight: bold;
    margin-bottom: 5px;
    color: #555;
}

.card-creator input,
.card-creator select {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
}

.card-creator button {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
}

.card-creator button:hover {
    background-color: #0056b3;
}

.card-pair {
    display: flex;
    justify-content: space-between;
    gap: 20px;
}

.card {
    flex: 1;
    background-color: #fff;
    padding: 15px;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card h3 {
    margin-bottom: 10px;
    color: #333;
}

.card label {
    font-size: 14px;
    color: #444;
}

.card input,
.card select {
    margin-bottom: 10px;
}
</style>