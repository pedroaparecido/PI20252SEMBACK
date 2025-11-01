require('dotenv').config()

const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const { csrfSync } = require('csrf-sync')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const connectMongo = require('./middleware/connection')
const Categoria = require('./model/categories')
const Order = require('./model/order')
const Produto = require('./model/product')
const Usuario = require('./model/usuario')
const Endereco = require('./model/Address')
const { default: MercadoPagoConfig, Payment } = require('mercadopago')

const app = express()

/**
 *
 * env production e development
 *  
 * 1° contratar plano gratuito de 1 ano aws ou azure
 * 2° criar uma maquina virtual
 * 3° criar uma rede (fornecer o ip para essa maquina virtual)
 * 4° Nessa maquina virtual instalar o docker + gerenciador de docker (portainer) (porta 9000 adicionar docker) (como instalar docker + portainer no azure ou no aws)
 * 5° instanciar 1 image com deploy do express.js
 * 6° instanciar uma image com deploy react
 * 
 * 
 * azure devops:
 * pedroaparecido
 * 
 */

const client = new MercadoPagoConfig({ 
        accessToken: process.env.API_MP,
        options: {
            timeout: 5000
        }
})

app.disable('x-powered-by')

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use(express.static(path.join(__dirname, 'public')))

// *****************Começo do auth

app.use(cookieParser('COOKIE_SECRET'))


// ----------------------------------------------------
// ROTA SECRETA COM AUTORIZAÇÃO PARA ATIVAR O ACESSO
// Link: http://localhost:3003/auth/check?authkey=MUDAR_ISTO_PARA_ENV_SUPER_SECRETO_123
// ----------------------------------------------------
app.get('/auth/check', (req, res) => {
    const chaveDeAutorizacao = req.query.authkey

    const redirectTo = req.query.redirect_to || 'http://localhost:3000/auth/register'

    // 1. VERIFICAÇÃO DE AUTORIZAÇÃO:
    if (!chaveDeAutorizacao || chaveDeAutorizacao !== 'XYZ-MEU-SEGREDO-ADMIN-MUITO-FORTE-12345') {
        return res.status(403).send('Acesso Negado. Chave de autorização inválida.')
    }
    
    
    // 2. Define as opções do Cookie
    const cookieOptions = {
        httpOnly: true, // O cookie não é acessível via JS no frontend
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000 * 24, // Expira em 24 horas
        sameSite: 'Lax',
        path: '/',
        signed: true // Se você usar o `cookieParser` sem segredo, ele pode ser simples. Com `signed`, é mais seguro.
    }
    
    res.cookie('admin_acesso_master', 'ACESSO_LIBERADO_456', cookieOptions)
})

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

app.post('/auth/signin', csrfSynchronisedProtection, csrfErrorHandler, async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) return res.status(400).json({ message: 'Todos os campos são obrigatórios.' })

        const user = await Usuario.findOne({ email })

        if (!user) return res.status(401).json({ message: 'Credenciais inválidas' })

        const passwordMatch = await bcrypt.compare(password, user.password)

        if (!passwordMatch) return res.status(401).json({ message: 'Credenciais inválidas' })

        req.session.usuario = {
            id: user._id,
            email: user.email
        }
        
        if (user) {
            res.status(200).json({
                message: 'Login bem-sucedido!',
                user: {
                    id: user._id,
                    email: user.email
                }
            })
        }
    } catch (error) {
        console.error('Erro ao logar com o usuário, erro:', error)
        res.status(500).send(error.message)
    }
})

app.post('/auth/signup', csrfSynchronisedProtection, csrfErrorHandler, async (req, res) => {
    try {
        const { name, email, password } = req.body

        if (!name || !email || !password) return res.status(400).json({ message: 'Todos os campos são obrigatórios.' })

        const salt = await bcrypt.genSalt(10)

        const hashedPass = await bcrypt.hash(password, salt)

        const findUser = await Usuario.findOne({
            email: email
        })

        if (findUser) return res.status(409).json({ message: 'Email já cadastrado!'})

        const newUser = await Usuario.create({ name, email, password: hashedPass })

        if (newUser) {
            const userResponse = { ...newUser }
            delete userResponse.password
            
            res.status(201).json({ message: 'Usuário cadastrado com sucesso!' })
        }
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

/*app.use((err, req, res, next) => {
    console.error("Global Error Handler caught an error:", err)
    if (res.headersSent) {
        return next(err)
    }
    res.status(err.statusCode || 500).json({
        error: err.name || 'Internal Server Error',
        message: err.message || 'An unexpected error occurred.'
    })
})*/

// ****************************fim do auth, só falta ver a comparação de senha porque qualquer um pode entrar a logica da senha é um if password === password 

app.get('/products', async (req, res) => {
    try {
        const products = await Produto.find({})
        res.status(200).json(products)
    } catch (err) {
        console.error('Erro ao buscar produtos:', err)
        res.status(500).json({ message: 'Erro ao buscar produtos.' })
    }
})

app.post('/product/new', async (req, res) => {
    
    try {
        const categoriaDoc = await Categoria.findOne({ nome: req.body.productData.categoriaNome })

        if (!categoriaDoc) {
            return res.status(404).json({ message: 'Categoria não encontrada.' })
        }

        const newProduct = await Produto.create({
            title: req.body.productData.title,
            description: req.body.productData.description,
            price: req.body.productData.price,
            categoria: categoriaDoc._id
        })

        res.status(201).json(newProduct)
    } catch (err) {
        console.error(err)
        res.status(500)
    }
})

app.get('/product/categoryId/:id', async (req, res) => {
    try {
        const productCategory = await Produto.find({
            categoria: {
                _id: req.params.id
            }
        })
        
        if (!productCategory) return res.status(404).json({ message: 'Erro ao buscar os produtos da categoria!'})
    
        res.status(200).json(productCategory)
    } catch (err) {
        console.error('Erro ao buscar produtos da categoria.', err)
        res.status(500).json({ message: 'Erro ao buscar produtos da categoria!'})
    }
})

app.patch('/product/edit/:id', async (req, res) => {
    try {
        const { title, description, categoria, image } = req.body
        
        const updateFields = {}
        if (title) updateFields.title = title
        if (description) updateFields.description = description
        if (categoria) updateFields.categoria = categoria
        if (image) updateFields.image = image

        const updatedProduct = await Produto.findByIdAndUpdate(
            req.params.id, 
            { $set: updateFields }, 
            { new: true, runValidators: true }
        )

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Produto não encontrado.' })
        }

        res.status(200).json(updatedProduct)
    } catch (err) {
        console.error('Erro ao editar produto:', err)
        res.status(500).json({ message: 'Erro ao editar produto.' })
    }
})

app.delete('/product/del', async (req, res) => {
    try {
        const { title } = req.body

        if (!title) {
            return res.status(400).json({ message: 'O título do produto é obrigatório para a exclusão.' })
        }

        const deletedProduct = await Produto.findOneAndDelete({ title: title })

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Produto não encontrado.' })
        }

        res.status(200).json({ message: 'Produto excluído com sucesso.', deletedProduct })
    } catch (err) {
        console.error('Erro ao excluir produto:', err)
        res.status(500).json({ message: 'Erro interno do servidor ao excluir o produto.' })
    }
})

//************* categorias

app.get('/categories', async (req, res) => {
    try {
        const categories = await Categoria.find({})
        
        res.status(200).json(categories)
    } catch (err) {
        console.error('Erro ao buscar categorias:', err)
        res.status(500)
    }
})

app.post('/categories/new', async (req, res) => {
    try {
        const newCategorie = await Categoria.create({
            nome: req.body.nome, 
            parent: req.body.parentId ? req.body.parentId : null
        })

        if (newCategorie)
            res.status(201).json(newCategorie)
    } catch (err) {
        console.error(err)
        res.status(500)
    }
})

app.delete('/category/del', async (req, res) => {
    try {
        const { nome } = req.body

        if (!nome) {
            return res.status(400).json({ message: 'O nome da categoria é obrigatório para a exclusão.' })
        }

        const deletedCategory = await Categoria.findOneAndDelete({ nome: nome })

        if (!deletedCategory) {
            return res.status(404).json({ message: 'Categoria não encontrada.' })
        }

        res.status(200).json({ message: 'Categoria excluída com sucesso.', deletedCategory })

    } catch (err) {
        console.error('Erro ao excluir categoria:', err)
        res.status(500).json({ message: 'Erro interno do servidor ao excluir a categoria.' })
    }
})

//*********************PEDIDO */

app.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find()
        
        if(orders) {
            res.status(200).json(orders)
        }
    } catch (err) {
        console.log(err)
    }
})

app.post('/order/new', async (req, res) => {
    try {
        const orderItems = req.body.orderItems.map((items) => ({
            productId: items.productId,
            title: items.title,
            price: items.price,
            quantity: items.quantity,
            total: items.total,
            date: Date.now()
        }))

        const newOrder = await Order.insertMany(orderItems)

        if (newOrder)
            res.status(200).json(newOrder)
        } catch (err) {
            console.log(err)
            res.status(500).json({ message: 'Erro ao processar o pedido.' })
    }
})

app.delete('/order/del', async (req, res) => {
    console.log(req.body)
    try {
        const deleteById = await Order.findByIdAndDelete({
            _id: req.body._id
        })
        

        if (deleteById) return res.status(200).json(deleteById)
    } catch (err) {
        console.log(err)
    }
})

//************************************ENDEREÇO

app.post('/address/new', async (req, res) => {
    try {
        const newAddress = await Endereco.create({
            cep: req.body.address.cep,
            rua: req.body.address.street,
            numero: req.body.address.number,
            bairro: req.body.address.neighborhood,
            complemento: req.body.address.complement,
            orderId: req.body.address.orderId
        })

        if (newAddress) res.status(201).json(newAddress)
    } catch (err) {
        console.log(err)
    }
})

// ******************************GATEWAY DE PAGAMENTO
const payment = new Payment(client)

app.post('/gateway/pay', csrfSynchronisedProtection, csrfErrorHandler, async (req, res) => {
    console.log(req.body)
    const { total, email } = req.body

    try {
        const paymentBody = {
            transaction_amount: 0.50,
            description: req.body.description || 'Pagamento de Pedido na Loja',
            payment_method_id: 'pix',
            payer: {
                email: 'pedro@teste.com',
            } 
        }

        const paymentResponse = await payment.create({ body: paymentBody })

        res.status(201).json({
            id: paymentResponse.id,
            valor: paymentResponse.transaction_amount,
            status: paymentResponse.status,
            qr_code: paymentResponse.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: paymentResponse.point_of_interaction.transaction_data.qr_code_base64,
            ticket_url: paymentResponse.point_of_interaction.transaction_data.ticket_url,
            external_resource_url: paymentResponse.point_of_interaction.transaction_data.external_resource_url
        })

    } catch (error) {
        console.error(error)
    }
})

app.get('/gateway/status/:paymentId', async (req, res) => {
    const paymentId = req.params.paymentId

    try {
        const paymentDetails = await payment.get({ id: paymentId })

        res.json({
            id: paymentDetails.id,
            status: paymentDetails.status,
            status_detail: paymentDetails.status_detail 
        })

    } catch (error) {
        console.error('Erro ao buscar status do pagamento:', error)
        res.status(500).json({ message: 'Erro ao consultar status.' })
    }
})

app.listen(3003, () => {
    console.log('Backend rodando na porta 3003')
    connectMongo()
})

module.exports = app