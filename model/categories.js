const mongoose = require('mongoose')

const Categoria = mongoose.Schema({
    nome: { type: String, required: true },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Categorie',
        default: null
    }
})

module.exports = mongoose.model('Categorie', Categoria)