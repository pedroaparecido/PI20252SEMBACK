const mongoose = require('mongoose')

const Usuario = mongoose.Schema({
    nome: { type: String, require: true },
    email: { type: String, require: true, unique: true},
    password: { type: String, require: true },
    role: {
        type: String,
        enum: ['admin'],
        default: null
    }
})

module.exports = mongoose.model('User', Usuario)