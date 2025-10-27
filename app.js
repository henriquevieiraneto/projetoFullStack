// 1. IMPORTAÇÃO DE MÓDULOS ESSENCIAIS
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Para permitir requisições do Frontend
const mysql = require('mysql2'); // Usaremos mysql2 para melhor performance
const path = require('path'); // Módulo para lidar com caminhos de arquivo

const app = express();
const port = 3000;

// 2. CONFIGURAÇÃO DO MIDDLEWARE
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração do CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500'], // Permite acesso do próprio servidor e do Live Server (para debug)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// 3. CONFIGURAÇÃO DA CONEXÃO COM O BANCO DE DADOS (MySQL)
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root', // Usuário padrão do MySQL/XAMPP
    password: '@Hvn2009', // Senha atualizada
    database: 'devhub' // Nome do banco criado via dump.sql
}).promise(); // Usando .promise() para permitir async/await nas consultas

// 4. ROTAS ESTÁTICAS PARA SERVIR O FRONTEND
// Servindo a pasta 'src' inteira sob o prefixo '/src'
app.use('/src', express.static(path.join(__dirname, 'src')));

// 5. ROTA PRINCIPAL: REDIRECIONA PARA A PÁGINA DE LOGIN (*** CORREÇÃO APLICADA AQUI ***)
app.get('/', (req, res) => {
    // Redireciona para o caminho correto da página de login dentro da pasta src/view/login
    res.redirect('/src/view/login/login.html');
});


// =================================================================
// ROTAS DE AUTENTICAÇÃO
// =================================================================

// POST /cadastro - CADASTRO DE NOVO USUÁRIO
app.post('/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;

    // NOTA: Idealmente, hashear a senha aqui com bcrypt
    const query = 'INSERT INTO usuario (nome, email, senha) VALUES (?, ?, ?)';
    try {
        const [results] = await pool.query(query, [nome, email, senha]);
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', id: results.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email já cadastrado.' });
        }
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ message: 'Erro interno ao cadastrar.' });
    }
});

// POST /login - LOGIN DE USUÁRIO
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    const query = 'SELECT id, nome, senha FROM usuario WHERE email = ?';

    try {
        const [rows] = await pool.query(query, [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const user = rows[0];

        // Comparação de senha (simplificada - usar bcrypt.compare em produção)
        if (user.senha === senha) {
            return res.status(200).json({
                message: 'Login bem-sucedido!',
                id: user.id,
                nome: user.nome
            });
        } else {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

    } catch (error) {
        console.error('Erro durante o login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


// =================================================================
// ROTAS DE LOGS (CRUD)
// =================================================================

// POST /logs - CRIA NOVO LOG (Versão Final Limpa)
app.post('/logs', async (req, res) => {
    // Campos que o Frontend envia (cad_logs.js)
    const { id_usuario, horas_trabalhadas, descricao, data_log, titulo, categoria, linhas_codigo, bugs_corrigidos } = req.body;

    if (!id_usuario) {
        return res.status(400).json({ message: 'ID do usuário é obrigatório.' });
    }

    // Tratamento de dados para garantir NULL ou valor padrão para campos ausentes/NaN
    // CORREÇÃO: Usar string vazia '' para campos NOT NULL como titulo e categoria
    const final_titulo = titulo || ''; // Usa string vazia se for null/undefined
    const final_categoria = categoria || ''; // Usa string vazia se for null/undefined
    const final_linhas_codigo = isNaN(parseInt(linhas_codigo)) ? null : parseInt(linhas_codigo);
    const final_bugs_corrigidos = isNaN(parseInt(bugs_corrigidos)) ? null : parseInt(bugs_corrigidos);
    const final_horas_trabalhadas = isNaN(parseFloat(horas_trabalhadas)) ? null : parseFloat(horas_trabalhadas);
    const final_descricao_do_trabalho = descricao || null;
    const final_data_log = data_log || null; // Pode ser NULL se o DB permitir ou se for data_registro

    // Query com 7 campos (removendo data_log se a coluna for data_registro no DB)
    const query =
        `INSERT INTO log_dev
        (id_usuario, titulo, categoria, descricao_do_trabalho, horas_trabalhadas, linhas_codigo, bugs_corrigidos)
        VALUES (?, ?, ?, ?, ?, ?, ?)`; // 7 placeholders

    // A ordem dos values DEVE bater com a ordem dos campos acima!
    const values = [ // 7 valores
        id_usuario,
        final_titulo,
        final_categoria,
        final_descricao_do_trabalho,
        final_horas_trabalhadas,
        final_linhas_codigo,
        final_bugs_corrigidos
    ];

    try {
        await pool.query(query, values);
        res.status(201).json({ message: "Log cadastrado com sucesso!" });
    } catch (error) {
        console.error("Erro fatal ao inserir log (SQL):", error);
        res.status(500).json({
            message: "Falha ao cadastrar log no banco de dados.",
            errorDetail: error.sqlMessage // MENSAGEM DETALHADA DO MYSQL
        });
    }
});

// GET /logs - LISTA TODOS OS LOGS COM FILTRO/PESQUISA E PAGINAÇÃO
app.get('/logs', async (req, res) => {
    // Inclui userId para saber se o usuário curtiu
    const { pagina = 1, quantidade = 10, categoria, search, userId } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(quantidade);

    let baseQuery = `
        SELECT
            ld.*,
            u.nome AS usuario_nome,
            (SELECT COUNT(*) FROM likes l WHERE l.id_log = ld.id) AS likes_count,
            -- Subquery para verificar se o usuário atual (userId) curtiu este log
            EXISTS(SELECT 1 FROM likes l_user WHERE l_user.id_log = ld.id AND l_user.id_user = ?) AS usuarioCurtiu
        FROM log_dev ld
        JOIN usuario u ON ld.id_usuario = u.id
        WHERE 1=1
    `;
    // Adiciona o userId como primeiro parâmetro para a subquery EXISTS
    const params = [userId || null]; // Usa null se userId não for fornecido

    if (categoria) {
        baseQuery += ' AND ld.categoria = ?';
        params.push(categoria);
    }

    if (search) {
        baseQuery += ' AND (ld.titulo LIKE ? OR ld.descricao_do_trabalho LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    baseQuery += ' ORDER BY ld.data_registro DESC LIMIT ? OFFSET ?';
    params.push(parseInt(quantidade), offset);

    try {
        const [logs] = await pool.query(baseQuery, params);
        // Converte o resultado de usuarioCurtiu para booleano
        const formattedLogs = logs.map(log => ({
            ...log,
            usuarioCurtiu: Boolean(log.usuarioCurtiu)
        }));
        res.status(200).json(formattedLogs);
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({ message: 'Erro ao buscar logs no banco de dados.' });
    }
});


// =================================================================
// ROTAS DE MÉTRICAS E LIKES
// =================================================================

// GET /metricas-usuario/:id - MÉTRICAS INDIVIDUAIS
app.get('/metricas-usuario/:id', async (req, res) => {
    const userIdParam = req.params.id;

    const query = `
        SELECT
            COUNT(ld.id) AS total_logs,
            SUM(ld.horas_trabalhadas) AS horas_trabalhadas,
            SUM(ld.bugs_corrigidos) AS bugs_corrigidos
        FROM log_dev ld
        WHERE ld.id_usuario = ?
    `;

    try {
        const [rows] = await pool.query(query, [userIdParam]);

        if (rows.length > 0) {
            const metricas = {
                total_logs: parseInt(rows[0].total_logs) || 0,
                horas_trabalhadas: parseFloat(rows[0].horas_trabalhadas) || 0.0,
                bugs_corrigidos: parseInt(rows[0].bugs_corrigidos) || 0,
            };
            return res.status(200).json(metricas);
        }

        res.status(200).json({ total_logs: 0, horas_trabalhadas: 0.0, bugs_corrigidos: 0 });

    } catch (error) {
        console.error('Erro ao buscar métricas do usuário:', error);
        res.status(500).json({ message: 'Erro ao buscar métricas no banco de dados.' });
    }
});

// POST /likes - ADICIONA UM LIKE
app.post('/likes', async (req, res) => {
    const { id_log, id_user } = req.body;

    // Validação
    if (!id_log || !id_user) {
        return res.status(400).json({ message: 'IDs de log e usuário são obrigatórios.' });
    }

    const checkQuery = 'SELECT id FROM likes WHERE id_user = ? AND id_log = ?';

    try {
        const [existingLikes] = await pool.query(checkQuery, [id_user, id_log]);

        if (existingLikes.length > 0) {
            return res.status(409).json({ message: 'Like já existente.' });
        }

        const insertQuery = 'INSERT INTO likes (id_user, id_log) VALUES (?, ?)';
        await pool.query(insertQuery, [id_user, id_log]);

        res.status(201).json({ message: 'Like registrado com sucesso.' });

    } catch (error) {
        console.error('Erro ao registrar like:', error);
        // Verifica erro de chave estrangeira (usuário ou log não existe)
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(404).json({ message: 'Usuário ou Log não encontrado.' });
        }
        res.status(500).json({ message: 'Erro interno ao registrar like.' });
    }
});

// DELETE /likes - REMOVE UM LIKE (usa query parameters)
app.delete('/likes', async (req, res) => {
    const { id_log, id_user } = req.query;

    if (!id_log || !id_user) {
        return res.status(400).json({ message: 'IDs de log e usuário são obrigatórios.' });
    }

    const deleteQuery = 'DELETE FROM likes WHERE id_log = ? AND id_user = ?';

    try {
        const [results] = await pool.query(deleteQuery, [id_log, id_user]);

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Like não encontrado para remoção.' });
        }

        res.status(200).json({ message: 'Like removido com sucesso.' });

    } catch (error) {
        console.error('Erro ao remover like:', error);
        res.status(500).json({ message: 'Erro interno ao remover like.' });
    }
});

// 11. INICIA O SERVIDOR
app.listen(port, () => {
    console.log(`Servidor rodando na porta: http://localhost:${port}`);
    console.log(`Acesse o Frontend em: http://localhost:${port}/src/view/login/login.html`); // Link inicial agora é o login
});

