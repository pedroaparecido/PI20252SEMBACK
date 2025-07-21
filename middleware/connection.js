const mongoose = require('mongoose')

const connectMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGODB)
    } catch (err) {
        console.log(err)
    }
}

module.exports = connectMongo