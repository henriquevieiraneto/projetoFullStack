// 1. IMPORTAÇÃO DE MÓDULOS ESSENCIAIS
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Para permitir requisições do Frontend
const mysql = require('mysql2'); // Usaremos mysql2 para melhor performance
const path = require('path'); // Módulo 'path' para lidar com caminhos de arquivo

const app = express();
const port = 3000;

// 2. CONFIGURAÇÃO DO MIDDLEWARE
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração do CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// 3. CONFIGURAÇÃO DA CONEXÃO COM O BANCO DE DADOS (MySQL)
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost', 
    user: 'root', 
    password: 'senai', // SENHA (Confirme se 'senai' ou '@Hvn2009' é a correta)
    database: 'devhub' 
}).promise(); 

// 4. ROTA ESTÁTICA (PARA SERVIR O FRONTEND)
app.use('/src', express.static(path.join(__dirname, 'src')));

// Rota principal para redirecionar para o login
app.get('/', (req, res) => {
    res.redirect('/src/view/login/login.html');
});


// =================================================================
// ROTAS DE AUTENTICAÇÃO (Cadastro e Login)
// =================================================================

// 5. POST /cadastro
app.post('/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ message: "Todos os campos (nome, email, senha) são obrigatórios." });
    }
    const query = 'INSERT INTO usuario (nome, email, senha) VALUES (?, ?, ?)';
    try {
        const [results] = await pool.query(query, [nome, email, senha]);
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', id: results.insertId, nome: nome });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este email já está cadastrado.' });
        }
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ message: 'Erro interno ao cadastrar.' });
    }
});

// 6. POST /login
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) {
         return res.status(400).json({ message: "Email e senha são obrigatórios." });
    }
    const query = 'SELECT id, nome, senha FROM usuario WHERE email = ?';
    try {
        const [rows] = await pool.query(query, [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Email ou senha incorretos.' });
        }
        const user = rows[0];
        if (user.senha === senha) {
            return res.status(200).json({ 
                message: 'Login bem-sucedido!',
                id: user.id,
                nome: user.nome
            });
        } else {
            return res.status(401).json({ message: 'Email ou senha incorretos.' });
        }
    } catch (error) {
        console.error('Erro durante o login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


// =================================================================
// ROTAS DE LOGS (CRUD)
// =================================================================

// 7. POST /logs - CRIA NOVO LOG
app.post('/logs', async (req, res) => {
    const { id_usuario, titulo, categoria, horas_trabalhadas, linhas_codigo, bugs_corrigidos, descricao_do_trabalho, data_log } = req.body;
    if (!id_usuario || !titulo || !categoria) {
        return res.status(400).json({ message: 'ID do usuário, Título e Categoria são obrigatórios.' });
    }
    const final_titulo = titulo || '';
    const final_categoria = categoria || '';
    const final_horas_trabalhadas = parseFloat(horas_trabalhadas) || 0;
    const final_linhas_codigo = parseInt(linhas_codigo) || 0; 
    const final_bugs_corrigidos = parseInt(bugs_corrigidos) || 0;
    const final_descricao = descricao_do_trabalho || null;
    const final_data = data_log || new Date().toISOString().split('T')[0]; 
    
    const query = 
        `INSERT INTO log_dev 
        (id_usuario, titulo, categoria, descricao_do_trabalho, horas_trabalhadas, linhas_codigo, bugs_corrigidos, data_log) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [ 
        id_usuario, 
        final_titulo, 
        final_categoria, 
        final_descricao, 
        final_horas_trabalhadas, 
        final_linhas_codigo, 
        final_bugs_corrigidos,
        final_data
    ];
    
    try {
        const [results] = await pool.query(query, values);
        res.status(201).json({ message: "Log cadastrado com sucesso!", id: results.insertId });
    } catch (error) {
        console.error("Erro fatal ao inserir log (SQL):", error);
        res.status(500).json({ 
            message: "Falha ao cadastrar log no banco de dados.", 
            errorDetail: error.sqlMessage 
        });
    }
});

// 8. GET /logs/:id - BUSCA UM LOG ESPECÍFICO (para Edição)
app.get('/logs/:id', async (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM log_dev WHERE id = ?';
    try {
        const [rows] = await pool.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Log não encontrado." });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar log por ID:', error);
        res.status(500).json({ message: 'Erro interno do servidor.', errorDetail: error.sqlMessage });
    }
});

// 9. GET /logs - LISTA TODOS OS LOGS (ATUALIZADO com contagem de comentários)
app.get('/logs', async (req, res) => {
    const { pagina = 1, quantidade = 10, categoria, search, userId } = req.query;
    if (!userId) {
        return res.status(400).json({ message: "ID do usuário (userId) é obrigatório para verificar likes." });
    }
    const offset = (parseInt(pagina) - 1) * parseInt(quantidade);
    
    let baseQuery = `
        SELECT 
            ld.id,
            ld.id_usuario,
            ld.titulo,
            ld.categoria,
            ld.descricao_do_trabalho,
            ld.horas_trabalhadas,
            ld.linhas_codigo,
            ld.bugs_corrigidos,
            ld.data_registro,
            u.nome AS usuario_nome, 
            (SELECT COUNT(*) FROM likes l WHERE l.id_log = ld.id) AS likes_count,
            (SELECT COUNT(*) FROM comentarios c WHERE c.id_log = ld.id) AS comentarios_count,
            (SELECT COUNT(*) FROM likes l_user WHERE l_user.id_log = ld.id AND l_user.id_user = ?) AS usuarioCurtiu
        FROM log_dev ld
        JOIN usuario u ON ld.id_usuario = u.id
        WHERE 1=1 
    `;
    const params = [userId]; 

    if (categoria) {
        baseQuery += ' AND ld.categoria = ?';
        params.push(categoria);
    }
    if (search) {
        baseQuery += ' AND (ld.titulo LIKE ? OR ld.descricao_do_trabalho LIKE ? OR u.nome LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    baseQuery += ' ORDER BY ld.data_registro DESC LIMIT ? OFFSET ?';
    params.push(parseInt(quantidade), offset);

    try {
        const [logs] = await pool.query(baseQuery, params);
        const logsFormatados = logs.map(log => ({
            ...log,
            usuarioCurtiu: log.usuarioCurtiu > 0
        }));
        res.status(200).json(logsFormatados);
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({ message: 'Erro ao buscar logs no banco de dados.', errorDetail: error.sqlMessage });
    }
});


// 10. PUT /logs/:id - ATUALIZA UM LOG (Editar)
app.put('/logs/:id', async (req, res) => {
    const { id } = req.params;
    const { titulo, categoria, horas_trabalhadas, linhas_codigo, bugs_corrigidos, descricao_do_trabalho, data_log } = req.body;
    if (!titulo || !categoria) {
        return res.status(400).json({ message: 'Título e Categoria são obrigatórios.' });
    }
    const final_horas = parseFloat(horas_trabalhadas) || 0;
    const final_linhas = parseInt(linhas_codigo) || 0;
    const final_bugs = parseInt(bugs_corrigidos) || 0;
    const final_descricao = descricao_do_trabalho || '';
    const final_data = data_log || new Date().toISOString().split('T')[0];

    const query = `
        UPDATE log_dev SET 
            titulo = ?, categoria = ?, descricao_do_trabalho = ?, 
            horas_trabalhadas = ?, linhas_codigo = ?, bugs_corrigidos = ?, 
            data_registro = ? 
        WHERE id = ?
    `;
    const values = [
        titulo, categoria, final_descricao, 
        final_horas, final_linhas, final_bugs, 
        final_data, id 
    ];

    try {
        const [results] = await pool.query(query, values);
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Log não encontrado para atualização." });
        }
        res.status(200).json({ message: "Log atualizado com sucesso!" });
    } catch (error) {
        console.error("Erro fatal ao atualizar log (SQL):", error);
        res.status(500).json({ 
            message: "Falha ao atualizar log no banco de dados.", 
            errorDetail: error.sqlMessage 
        });
    }
});

// 11. DELETE /logs/:id - EXCLUI UM LOG
app.delete('/logs/:id', async (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM log_dev WHERE id = ?';
    try {
        const [results] = await pool.query(query, [id]);
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Log não encontrado para exclusão." });
        }
        res.status(200).json({ message: "Log excluído com sucesso." });
    } catch (error) {
        console.error('Erro ao excluir log:', error);
        res.status(500).json({ message: 'Erro interno do servidor.', errorDetail: error.sqlMessage });
    }
});


// =================================================================
// ROTAS DE COMENTÁRIOS (CRUD)
// =================================================================

// 12. GET /logs/:id/comentarios - BUSCA COMENTÁRIOS DE UM LOG
app.get('/logs/:id/comentarios', async (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT 
            c.id, c.comentario, c.data_comentario, c.id_usuario,
            u.nome AS usuario_nome 
        FROM comentarios c
        JOIN usuario u ON c.id_usuario = u.id
        WHERE c.id_log = ?
        ORDER BY c.data_comentario DESC
    `;
    try {
        const [comentarios] = await pool.query(query, [id]);
        res.status(200).json(comentarios);
    } catch (error) {
        console.error('Erro ao buscar comentários:', error);
        res.status(500).json({ message: 'Erro ao buscar comentários.', errorDetail: error.sqlMessage });
    }
});

// 13. POST /logs/:id/comentarios - ADICIONA UM COMENTÁRIO
app.post('/logs/:id/comentarios', async (req, res) => {
    const { id: id_log } = req.params; 
    const { id_usuario, comentario } = req.body; 

    if (!id_usuario || !comentario) {
        return res.status(400).json({ message: 'ID do usuário e texto do comentário são obrigatórios.' });
    }
    const query = 'INSERT INTO comentarios (id_log, id_usuario, comentario) VALUES (?, ?, ?)';
    try {
        await pool.query(query, [id_log, id_usuario, comentario]);
        res.status(201).json({ message: 'Comentário adicionado com sucesso!' });
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        res.status(500).json({ message: 'Erro ao salvar comentário.', errorDetail: error.sqlMessage });
    }
});

// 14. (NOVO) PUT /comentarios/:id - EDITA UM COMENTÁRIO
app.put('/comentarios/:id', async (req, res) => {
    const { id } = req.params; // ID do comentário
    const { comentario, id_usuario } = req.body; // Texto novo e ID do usuário (para segurança)

    if (!comentario || !id_usuario) {
        return res.status(400).json({ message: 'O texto do comentário e o ID do usuário são obrigatórios.' });
    }

    // Query de atualização segura: só permite editar se o ID do comentário E o ID do usuário baterem
    const query = 'UPDATE comentarios SET comentario = ? WHERE id = ? AND id_usuario = ?';
    
    try {
        const [results] = await pool.query(query, [comentario, id, id_usuario]);
        
        if (results.affectedRows === 0) {
            // Isso acontece se o comentário não existe OU se o usuário não for o dono
            return res.status(404).json({ message: "Comentário não encontrado ou você não tem permissão para editá-lo." });
        }
        res.status(200).json({ message: "Comentário atualizado com sucesso!" });
    } catch (error) {
        console.error('Erro ao atualizar comentário:', error);
        res.status(500).json({ message: 'Erro ao atualizar comentário.', errorDetail: error.sqlMessage });
    }
});

// 15. (NOVO) DELETE /comentarios/:id - EXCLUI UM COMENTÁRIO
app.delete('/comentarios/:id', async (req, res) => {
    const { id } = req.params; // ID do comentário
    const { id_usuario } = req.body; // ID do usuário (para segurança)

    if (!id_usuario) {
         return res.status(400).json({ message: 'ID do usuário é obrigatório para excluir.' });
    }

    // Query de exclusão segura: só permite excluir se o ID do comentário E o ID do usuário baterem
    const query = 'DELETE FROM comentarios WHERE id = ? AND id_usuario = ?';
    
    try {
        const [results] = await pool.query(query, [id, id_usuario]);

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Comentário não encontrado ou você não tem permissão para excluí-lo." });
        }
        res.status(200).json({ message: "Comentário excluído com sucesso." });
    } catch (error) {
        console.error('Erro ao excluir comentário:', error);
        res.status(500).json({ message: 'Erro ao excluir comentário.', errorDetail: error.sqlMessage });
    }
});


// =================================================================
// ROTAS DE MÉTRICAS E LIKES
// =================================================================

// 16. GET /metricas-usuario/:id - MÉTRICAS INDIVIDUAIS
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

// 17. POST /likes - ADICIONA UM LIKE
app.post('/likes', async (req, res) => {
    const { id_log, id_user } = req.body;
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
        res.status(500).json({ message: 'Erro interno ao registrar like.' });
    }
});

// 18. DELETE /likes - REMOVE UM LIKE
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
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// 19. INICIA O SERVIDOR
app.listen(port, () => {
    console.log(`Servidor rodando na porta: http://localhost:${port}`); 
    console.log(`Acesse o Frontend em: http://localhost:${port}/src/view/login/login.html`);
});

