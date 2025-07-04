require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const { doubleCsrf } = require('csrf-csrf')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const cors = require('cors')
const Usuario = require('./model/usuario')

const app = express()

app.disable('x-powered-by')

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use(cookieParser('CSRF_SECRET'))

app.use(session({
    secret: 'CSRF_SECRET',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60000 * 60,
    }
}))

const {
    invalidCsrfTokenError,
    generateCsrfToken,
    doubleCsrfProtection
} = doubleCsrf({
    getSecret: (req) => 'CSRF_SECRET',
    getSessionIdentifier: (req) => req.session ? req.session.id : 'anonymous-session-id',
    secret: 'CSRF_SECRET',
    cookieName: 'csrftoken',
    cookieOptions: {
        signed: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
    },
    headerName: 'X-CSRF-TOKEN',
});

const csrfErrorHandler = (error, req, res, next) => {
    if (error === invalidCsrfTokenError) {
        res.json({
            error: error,
            message: 'Invalid CSRF Token. Request blocked.'
        });
    } else {
        next(error);
    }
}

app.use((req, res, next) => {
    if (!req.session || !req.session.id) {
        req.session = req.session || {}
        
        req.session.id = require('crypto').randomUUID()
    }
    res.locals.csrfToken = generateCsrfToken(req, res)
    next();
});

app.get('/csrf-token', (req, res) => {
    const csrfToken = res.locals.csrfToken
    if (!csrfToken) {
        console.error("CSRF token is undefined in res.locals for /csrf-token route.");
        return res.status(500).json({ error: "Failed to generate CSRF token." });
    }

    res.status(200).json({ csrfToken });
});

app.use(doubleCsrfProtection)
app.use(csrfErrorHandler)

// Rotas

app.post('/auth/signin', (req, res) => {
    res.status(200).json({ message: 'Login bem-sucedido (ainda não implementado).' });
});

app.post('/auth/signup', async (req, res) => {
    console.log('------- SIGNUP ATTEMPT (CSRF Passed) -------');
    console.log('req.session.id (inside signup):', req.session ? req.session.id : 'No Session');
    console.log('Cookie csrftoken (httpOnly, server-side read):', req.signedCookies['csrftoken'])
    console.log('Header X-Csrf-Token:', req.headers['x-csrf-token']);

    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
        }

        const newUser = await Usuario.create({ name, email, password });

        req.session.usuario = {
            id: newUser._id,
            email: newUser.email
        };

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser });

    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Email já cadastrado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar usuário.' });
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ message: 'Erro ao fazer logout.' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
});

app.use((err, req, res, next) => {
    console.error("Global Error Handler caught an error:", err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(err.statusCode || 500).json({
        error: err.name || 'Internal Server Error',
        message: err.message || 'An unexpected error occurred.'
    });
});

app.listen(3003, () => console.log('Backend rodando na porta 3003'));

module.exports = app