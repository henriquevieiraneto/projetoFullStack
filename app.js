// 1. IMPORTAÇÃO DE MÓDULOS ESSENCIAIS
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Para permitir requisições do Frontend
const mysql = require('mysql2'); // Usaremos mysql2 para melhor performance

const app = express();
const port = 3000;

// 2. CONFIGURAÇÃO DO MIDDLEWARE
// Permite que o servidor processe dados JSON e formulários
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração do CORS para permitir que o Frontend (porta 3000 ou 5500) acesse o Backend
// O Frontend *deve* acessar pela porta 3000, mas o CORS é um bom backup.
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// 3. CONFIGURAÇÃO DA CONEXÃO COM O BANCO DE DADOS (MySQL)
// AS CREDENCIAIS FORAM ATUALIZADAS COM A NOVA SENHA: @Hvn2009
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost', 
    user: 'root', // Usuário padrão do MySQL/XAMPP
    password: '@Hvn2009', // <--- NOVA SENHA APLICADA AQUI
    database: 'devhub' // Nome do banco criado via dump.sql
}).promise(); // Usando .promise() para permitir async/await nas consultas

// Rota estática para servir os arquivos HTML, CSS e JS do Frontend
app.use('/view', express.static('src/view'));
app.use('/style', express.static('src/style'));

// Rota principal para redirecionar para o dashboard
app.get('/', (req, res) => {
    res.redirect('/view/index.html');
});


// =================================================================
// ROTAS DE AUTENTICAÇÃO
// =================================================================

// 4. POST /cadastro - CADASTRO DE NOVO USUÁRIO
app.post('/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;

    // NOTA: Em um projeto real, a senha deveria ser hasheada aqui (ex: com bcrypt)
    // Para simplificar, armazenaremos a senha como texto puro (TESTE)

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

// 5. POST /login - LOGIN DE USUÁRIO
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    
    const query = 'SELECT id, nome, senha FROM usuario WHERE email = ?';
    
    try {
        const [rows] = await pool.query(query, [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const user = rows[0];

        // Comparação da senha (texto puro vs. texto puro - simplificado)
        if (user.senha === senha) {
            // Sucesso! Retorna dados básicos (NÃO inclua a senha!)
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

// 6. POST /logs - CRIA NOVO LOG
app.post('/logs', async (req, res) => {
    const { id_usuario, titulo, categoria, descricao_do_trabalho, horas_trabalhadas, linhas_codigo, bugs_corrigidos } = req.body;
    
    // Validação básica para garantir que o ID do usuário está presente
    if (!id_usuario) {
        return res.status(400).json({ message: 'ID do usuário é obrigatório.' });
    }

    const query = `
        INSERT INTO log_dev (id_usuario, titulo, categoria, descricao_do_trabalho, horas_trabalhadas, linhas_codigo, bugs_corrigidos) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [id_usuario, titulo, categoria, descricao_do_trabalho, parseFloat(horas_trabalhadas), parseInt(linhas_codigo), parseInt(bugs_corrigidos)];
    
    try {
        const [results] = await pool.query(query, values);
        res.status(201).json({ message: 'Log registrado com sucesso!', id: results.insertId });
    } catch (error) {
        console.error('Erro ao registrar log:', error);
        res.status(500).json({ message: 'Falha ao cadastrar log no banco de dados.' });
    }
});

// 7. GET /logs - LISTA TODOS OS LOGS COM FILTRO/PESQUISA E PAGINAÇÃO
app.get('/logs', async (req, res) => {
    // Parâmetros de pesquisa e paginação
    const { pagina = 1, quantidade = 10, categoria, search } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(quantidade);
    
    let baseQuery = `
        SELECT 
            ld.*, 
            u.nome AS usuario_nome, 
            (SELECT COUNT(*) FROM likes l WHERE l.id_log = ld.id) AS likes_count
        FROM log_dev ld
        JOIN usuario u ON ld.id_usuario = u.id
        WHERE 1=1 
    `;
    const params = [];

    // Adiciona filtro por categoria
    if (categoria) {
        baseQuery += ' AND ld.categoria = ?';
        params.push(categoria);
    }
    
    // Adiciona filtro por pesquisa (título ou descrição)
    if (search) {
        baseQuery += ' AND (ld.titulo LIKE ? OR ld.descricao_do_trabalho LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    // Ordenação e Limite/Offset
    baseQuery += ' ORDER BY ld.data_registro DESC LIMIT ? OFFSET ?';
    params.push(parseInt(quantidade), offset);

    try {
        const [logs] = await pool.query(baseQuery, params);
        res.status(200).json(logs);
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({ message: 'Erro ao buscar logs no banco de dados.' });
    }
});


// =================================================================
// ROTAS DE MÉTRICAS E LIKES
// =================================================================

// 8. GET /metricas-usuario/:id - MÉTRICAS INDIVIDUAIS
app.get('/metricas-usuario/:id', async (req, res) => {
    const userId = req.params.id;
    
    const query = `
        SELECT 
            COUNT(ld.id) AS total_logs,
            SUM(ld.horas_trabalhadas) AS horas_trabalhadas,
            SUM(ld.bugs_corrigidos) AS bugs_corrigidos
        FROM log_dev ld
        WHERE ld.id_usuario = ?
    `;

    try {
        const [rows] = await pool.query(query, [userId]);
        
        // Se a query retornar um resultado (mesmo que todos os valores sejam NULL),
        // ele estará em rows[0].
        if (rows.length > 0) {
            // Converte NULLs para 0 para evitar problemas de tipo no Frontend
            const metricas = {
                total_logs: parseInt(rows[0].total_logs) || 0,
                horas_trabalhadas: parseFloat(rows[0].horas_trabalhadas) || 0.0,
                bugs_corrigidos: parseInt(rows[0].bugs_corrigidos) || 0,
            };
            return res.status(200).json(metricas);
        }

        // Caso o usuário não tenha logs
        res.status(200).json({ total_logs: 0, horas_trabalhadas: 0.0, bugs_corrigidos: 0 });

    } catch (error) {
        console.error('Erro ao buscar métricas do usuário:', error);
        res.status(500).json({ message: 'Erro ao buscar métricas no banco de dados.' });
    }
});

// 9. POST /likes - ADICIONA UM LIKE
app.post('/likes', async (req, res) => {
    const { id_log, id_user } = req.body;

    const checkQuery = 'SELECT id FROM likes WHERE id_user = ? AND id_log = ?';
    
    try {
        const [existingLikes] = await pool.query(checkQuery, [id_user, id_log]);
        
        // Verifica se o like já existe
        if (existingLikes.length > 0) {
            // Retorna status 409 (Conflict) se a entrada duplicada for detectada
            return res.status(409).json({ message: 'Like já existente.' }); 
        }

        // Se não existir, insere
        const insertQuery = 'INSERT INTO likes (id_user, id_log) VALUES (?, ?)';
        await pool.query(insertQuery, [id_user, id_log]);
        
        res.status(201).json({ message: 'Like registrado com sucesso.' });
        
    } catch (error) {
        console.error('Erro ao registrar like:', error);
        res.status(500).json({ message: 'Erro interno ao registrar like.' });
    }
});

// 10. DELETE /likes - REMOVE UM LIKE (usa query parameters)
app.delete('/likes', async (req, res) => {
    const { id_log, id_user } = req.query; // Pega o ID do log e usuário dos query parameters
    
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
    console.log(`Servidor rodando na porta: http://localhost:${port}`); //
    console.log(`Acesse o Frontend em: http://localhost:${port}/view/index.html`);
});