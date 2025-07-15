require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const { csrfSync } = require('csrf-sync')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const cors = require('cors')
const connectMongo = require('./middleware/connection')
const Usuario = require('./model/usuario')

const app = express()

app.disable('x-powered-by')

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use(cookieParser('COOKIE_SECRET'))

app.use(session({
    secret: 'SESSION_SECRET',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: false,
        maxAge: 60000 * 60,
    }
}))

const {
    invalidCsrfTokenError,
    generateToken,
    getTokenFromRequest,
    getTokenFromState,
    storeTokenInState,
    revokeToken,
    csrfSynchronisedProtection
} = csrfSync()

const csrfErrorHandler = (error, req, res, next) => {
    if (error === invalidCsrfTokenError) {
        console.warn('CSRF Validation Error: Invalid token detected for URL:', req.originalUrl, 'Method:', req.method)
        console.warn('Frontend CSRF Token (Header):', req.headers['x-csrf-token'])
        console.warn('Backend CSRF Cookie (signed):', req.signedCookies['csrftoken'])
        if (!res.headersSent) {
            return res.status(403).json({
                error: 'CSRF Validation Error',
                message: 'Invalid CSRF Token. Request blocked.'
            })
        }
        return
    } else {
        next(error)
    }
}

app.get('/auth/status', (req, res) => {
    if (req.session && req.session.usuario) {
        res.status(200).json({
            loggedIn: true,
            user: {
                id: req.session.usuario.id,
                email: req.session.usuario.email,
            }
        })
    } else {
        res.status(200).json({ loggedIn: false })
    }
})

app.get('/csrf-token', (req, res) => {
    const csrfToken = generateToken(req, res)
    res.json({ csrfToken })
})

// Rotas

app.post('/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios.' })
        }

        const user = await Usuario.find({ email })

        req.session.usuario = {
            id: user._id,
            email: user.email
        }

        if (user) {
            res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser })
            res.redirect('/')
        }

    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error)
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Email já cadastrado.' })
        }
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar usuário.' })
    }
})

app.post('/auth/signup', csrfSynchronisedProtection, csrfErrorHandler, async (req, res) => {
    try {
        console.log(req.body)
        const { name, email, password } = req.body

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios.' })
        }

        const newUser = await Usuario.create({ name, email, password })

        req.session.usuario = {
            id: newUser._id,
            email: newUser.email
        }

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser })

    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error)
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Email já cadastrado.' })
        }
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar usuário.' })
    }
})

app.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err)
            return res.status(500).json({ message: 'Erro ao fazer logout.' })
        }
        res.clearCookie('connect.sid')
        res.status(200).json({ message: 'Logout bem-sucedido.' })
    })
})

app.use((err, req, res, next) => {
    console.error("Global Error Handler caught an error:", err)
    if (res.headersSent) {
        return next(err)
    }
    res.status(err.statusCode || 500).json({
        error: err.name || 'Internal Server Error',
        message: err.message || 'An unexpected error occurred.'
    })
})

app.listen(3003, () => {
    console.log('Backend rodando na porta 3003')
    connectMongo()
})

module.exports = app