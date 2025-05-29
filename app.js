const express = require('express')
const bodyParser = require('body-parser')
const csurf = require('csurf')

const routesAuth = require('./route/auth')

const app = express()

app.disable('x-powered-by')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(csurf())
app.use((req, res, next) => {
    res.locals._csrf = req.csrfToken()
    next()
})

app.listen(3003, () => console.log('Rodando na porta 3003'))

module.exports = app