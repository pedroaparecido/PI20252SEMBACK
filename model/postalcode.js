const mongoose = require('mongoose')

const CodigoPostal = mongoose.Schema({
    cep: { type: String, required: true},
    bairro: { type: String, required: true},
    rua: { type: String, required: true },
    numero: { type: String, required: true },
    complemento: { type: String },
    orderId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Order',
        required: true
    }
})

module.exports = mongoose.model('PostalCode', CodigoPostal)