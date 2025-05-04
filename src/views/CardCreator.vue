<script setup>
import { db } from '../firebase/init.js';
import { addDoc, collection } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { notify } from '@kyvg/vue3-notification';
</script>

<template>
    <div class="card-creator">
        <h1>Creador de tarjetas</h1>
        <form id="cardCreatorForm" @submit.prevent="createCard">
            <div>
                <label for="category">Categoría:</label>
                <input type="text" id="category" v-model="cardData.category" />
            </div>
            <div>
                <label for="difficulty">Dificultad:</label>
                <select id="difficulty" v-model="cardData.difficulty">
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
                    <input type="text" id="card1-code" v-model="cardData.options[0].cardCode" />
                    <label for="card1-content">Contenido:</label>
                    <input type="text" id="card1-content" v-model="cardData.options[0].content" />
                    <label for="card1-type">Tipo de contenido:</label>
                    <select id="card1-type" v-model="cardData.options[0].contentType">
                        <option value="text">Texto</option>
                        <option value="image">Imagen</option>
                        <option value="audio">Audio</option>
                    </select>
                </div>
                <div class="card">
                    <h3>Tarjeta 2</h3>
                    <label for="card2-code">Código:</label>
                    <input type="text" id="card2-code" v-model="cardData.options[1].cardCode" />
                    <label for="card2-content">Contenido:</label>
                    <input type="text" id="card2-content" v-model="cardData.options[1].content" />
                    <label for="card2-type">Tipo de contenido:</label>
                    <select id="card2-type" v-model="cardData.options[1].contentType">
                        <option value="text">Texto</option>
                        <option value="image">Imagen</option>
                        <option value="audio">Audio</option>
                    </select>
                </div>
            </div>
            <button type="submit">Crear tarjeta</button>
        </form>
    </div>
</template>

<script>
export default {
    name: "CardCreator",
    data() {
        return {
            cardData: {
                category: "",
                difficulty: "easy",
                hint: "",
                options: [
                    { cardCode: "", content: "", contentType: "text" },
                    { cardCode: "", content: "", contentType: "text" },
                ]
            }
        };
    },
    methods: {
        async createCard() {
            const that = this;

            try {
                const fileTypes = { image: ".jpg", audio: ".mp3" };
                for (const [index, card] of [this.cardData.options[0], this.cardData.options[1]].entries()) {
                    if (fileTypes[card.contentType]) {
                        await this.uploadCardFile(card.cardCode, card.contentType, index, fileTypes[card.contentType], async function (fileName) {
                            await that.generateFileReference(fileName, card.contentType, fileTypes[card.contentType], async function (url) {
                                that.cardData.options[index].content = url;
                                await addDoc(collection(db, "cards"), that.cardData);
                                that.resetForm();
                                return notify({
                                    title: 'Tarjeta creada',
                                    text: 'La tarjeta ha sido creada exitosamente.',
                                    type: 'success'
                                });
                            });
                        });
                    }
                }
            } catch (error) {
                console.log(error)
                return notify({
                    title: 'Error al crear tarjeta',
                    text: 'Hubo un error al crear la tarjeta. Por favor, inténtalo de nuevo.',
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
            this.cardData.category = "";
            this.cardData.difficulty = "easy";
            this.cardData.hint = "";
            this.cardData.options[0] = { code: "", content: "", type: "text" };
            this.cardData.options[1] = { code: "", content: "", type: "text" };
        }
    }
};
</script>

<style scoped>
.card-creator {
    text-align: center;
    padding: 20px;
    font-family: Arial, sans-serif;
}

.card-creator p {
    color: #666;
}

.card-creator form {
    max-width: 600px;
    margin: 0 auto;
    background-color: #f9f9f9;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-creator form div {
    margin-bottom: 15px;
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