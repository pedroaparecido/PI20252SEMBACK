// produto.js
const mongoose = require('mongoose')

const Products = new mongoose.Schema({
    image: {
        type: String,
        default: 'http://localhost:3003/beers.jpg'
    },
    title: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    categoria: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Categorie',
        required: true
    },
    price: { type: Number, required: true },
    quantity: { type: Number }
})

module.exports = mongoose.model('Product', Products)