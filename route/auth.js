module.exports = (app) => {
    const { auth } = app.controllers
    app.post('/auth/login', auth.login)
    app.post('/auth/register', auth.register)
    app.post('/auth/logout', auth.logout)
}