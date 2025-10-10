const mongoose = require('mongoose')

const Order = new mongoose.Schema({
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product',
        required: true 
    },
    title: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    total: { type: Number, required: true },
    date: { type: Date, required: true }
})

module.exports = mongoose.model('Order', Order)