const mongoose = require('mongoose')

const Carrinho = mongoose.Schema({
    objectIds: { type: Array },
    //carrinhoId: { type: Schema.Types.objectId, ref: 'User' }
})

module.exports = mongoose.model('ShoppingCart', Carrinho)