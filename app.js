import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import path from 'path'; 
import { fileURLToPath } from 'url'; 

// ----------------------------------------------------
// Configuração do __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ----------------------------------------------------

// Configuração do Pool de Conexão com o Banco de Dados
const pool = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "senai",
    database: "devhub", // Nome do seu banco de dados
});

const app = express();

// MIDDLEWARES GERAIS
app.use(express.json()); 
app.use(cors()); 

// SERVINDO ARQUIVOS ESTÁTICOS (FRONTEND)
app.use(express.static(path.join(__dirname, 'src')));

// ROTA DE TESTE SIMPLES
app.get("/", (req, res) => {
    // Acessível via: http://localhost:3000/
    res.send("Servidor da API rodando. Acesse /view/index.html para o frontend."); //
});

// =========================================================================
// ROTAS DE USUÁRIOS
// =========================================================================

// ... Rotas GET, GET/:id, POST, PUT, DELETE /usuarios (Mantidas) ...
app.get("/usuarios", async (req, res) => {
    try {
      const [results] = await pool.query("SELECT id, nome, idade, email FROM usuario");
      res.send(results);
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      res.status(500).send("Erro interno do servidor.");
    }
});

app.get("/usuarios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [results] = await pool.query(
        "SELECT id, nome, idade, email FROM usuario WHERE id=?",
        id
      );
      if (results.length === 0) {
        return res.status(404).send("Usuário não encontrado.");
      }
      res.send(results[0]);
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      res.status(500).send("Erro interno do servidor.");
    }
});

app.post("/usuarios", async (req, res) => {
    try {
      const { nome, idade, email, senha } = req.body;
      const [results] = await pool.query(
        "INSERT INTO usuario (nome, idade, email, senha) VALUES (?, ?, ?, ?)",
        [nome, idade, email, senha]
      );
  
      const [usuarioCriado] = await pool.query(
        "SELECT id, nome, idade, email FROM usuario WHERE id=?",
        results.insertId
      );
  
      return res.status(201).json(usuarioCriado[0]);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).send("E-mail já cadastrado.");
      }
      res.status(500).send("Erro interno do servidor.");
    }
});

app.delete("/usuarios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [results] = await pool.query(
        "DELETE FROM usuario WHERE id=?",
        id
      );
      if (results.affectedRows === 0) {
          return res.status(404).send("Usuário não encontrado para exclusão.");
      }
      res.status(200).send("Usuário deletado com sucesso.");
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      res.status(500).send("Erro interno do servidor.");
    }
});

app.put("/usuarios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, idade } = req.body;
      const [results] = await pool.query(
        "UPDATE usuario SET nome = ?, idade = ? WHERE id = ?; ",
        [nome, idade, id]
      );
      
      if (results.affectedRows === 0) {
          return res.status(404).send("Usuário não encontrado para atualização.");
      }
  
      res.status(200).send("Usuário atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).send("Erro interno do servidor.");
    }
});
// =========================================================================
// ROTAS DE REGISTRO E LOGIN (Mantidas)
// =========================================================================

/* Cadastro de usuário (Rota de Registro) */
app.post("/registrar", async (req, res) => {
    try {
        const { nome, idade, email, senha } = req.body;
        
        const [results] = await pool.query(
          "INSERT INTO usuario (nome, idade, email, senha) VALUES (?, ?, ?, ?)",
          [nome, idade, email, senha]
        );
    
        const [usuarioCriado] = await pool.query(
          "SELECT id, nome, idade, email FROM usuario WHERE id=?",
          results.insertId
        );
    
        return res.status(201).json(usuarioCriado[0]);
      } catch (error) {
        console.error("Erro ao registrar usuário:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).send("E-mail já cadastrado.");
        }
        res.status(500).send("Erro interno do servidor.");
      }
});

/* LOGIN */
app.post("/login", async (req, res) => {
    try {
      const { email, senha } = req.body;
  
      const [usuario] = await pool.query(
        "Select id, nome, idade, email from usuario WHERE email=? AND senha=?",
        [email, senha]
      );
  
      if (usuario.length > 0) {
        return res.status(200).json({
          message: "Usuário logado com sucesso.",
          dados: usuario[0],
        });
      } else {
        return res.status(401).send("Email ou senha inválidos.");
      }
    } catch (error) {
      console.error("Erro no login:", error);
      res.status(500).send("Erro interno do servidor.");
    }
});

// =========================================================================
// ROTAS DE LOGS
// =========================================================================

/* * [MUDANÇA CRÍTICA]
 * Listagem de logs com paginação, filtro e nome de usuário
 */
app.get("/logs", async (req, res) => {
    try {
        const { pagina, quantidade, categoria, q } = req.query; // 'q' é a query de pesquisa de texto
        
        const page = Number(pagina) || 1;
        const limit = Number(quantidade) || 10;
        const offset = (page - 1) * limit;

        let whereClauses = [];
        let queryParams = [];

        // Filtro por Categoria
        if (categoria) {
            whereClauses.push("lgs.categoria = ?");
            queryParams.push(categoria);
        }

        // Filtro por Pesquisa de Texto (Nome/Descrição/Título)
        if (q) {
            const likeTerm = `%${q}%`;
            whereClauses.push("(u.nome LIKE ? OR lgs.descricao_do_trabalho LIKE ?)");
            queryParams.push(likeTerm, likeTerm);
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        // Consulta SQL (Melhorada para incluir o nome do usuário e a data de registro)
        const queryLogs = `
            SELECT 
                lgs.id, 
                lgs.categoria, 
                lgs.horas_trabalhadas, 
                lgs.linhas_codigo, 
                lgs.bugs_corrigidos, 
                lgs.id_user,
                lgs.data_registro,
                u.nome AS usuario_nome, -- Adiciona o nome do usuário
                COUNT(devhub.like.id) AS likes_count
            FROM lgs 
            INNER JOIN usuario u ON u.id = lgs.id_user -- Garante que apenas logs com usuário existam
            LEFT JOIN devhub.like ON devhub.like.id_log = lgs.id
            ${whereString}
            GROUP BY 
                lgs.id, lgs.categoria, lgs.horas_trabalhadas, lgs.linhas_codigo, 
                lgs.bugs_corrigidos, lgs.id_user, lgs.data_registro, u.nome
            ORDER BY lgs.data_registro DESC
            LIMIT ? OFFSET ?;
        `;
        
        // Parâmetros finais para a consulta (filtros + paginação)
        const finalParams = [...queryParams, limit, offset];

        const [results] = await pool.query(queryLogs, finalParams);
        
        // Nota: Para retornar 'totalPages', você precisaria fazer uma segunda query (COUNT(*)).
        res.send(results);
    } catch (error) {
        console.error("Erro ao listar logs:", error);
        res.status(500).send("Erro interno do servidor.");
    }
});

/* Cadastro de logs (cad_logs.html) */
app.post("/logs", async (req, res) => {
    try {
      const { categoria, horas_trabalhadas, linhas_codigo, bugs_corrigidos, id_user, descricao_do_trabalho } = req.body;
      
      const [results] = await pool.query(
        "INSERT INTO lgs(categoria, horas_trabalhadas, linhas_codigo, bugs_corrigidos, id_user, descricao_do_trabalho, data_registro) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        [
          categoria,
          horas_trabalhadas,
          linhas_codigo,
          bugs_corrigidos,
          id_user,
          descricao_do_trabalho // Adiciona a descrição
        ]
      );
      const [logCriado] = await pool.query(
        "SELECT * FROM lgs WHERE id=?",
        results.insertId
      );
      res.status(201).json(logCriado[0]);
    } catch (error) {
      console.error("Erro ao cadastrar log:", error);
      res.status(500).send("Erro interno do servidor.");
    }
});

/* Métricas por Usuário (metricas_usuario.html) (Mantida) */
app.get("/metricas-usuario/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [ results ] = await pool.query(
        `
        SELECT 
            SUM(horas_trabalhadas) AS horas_trabalhadas, 
            COUNT(id) AS total_logs, 
            SUM(bugs_corrigidos) AS bugs_corrigidos 
        FROM lgs 
        WHERE id_user = ?;
        `, id
      );
      res.send(results[0] || {}); 
    } catch (error) {
      console.error("Erro ao buscar métricas:", error);
      res.status(500).send("Erro interno do servidor.");
    }
});

// =========================================================================
// ROTAS DE LIKES (Mantidas)
// =========================================================================

app.get("/likes", async (req, res) => {
    try {
      const [results] = await pool.query("SELECT * FROM `like`");
      res.send(results);
    } catch (error) {
      console.error("Erro ao listar likes:", error);
      res.status(500).send("Erro interno do servidor.");
    }
});

app.post("/likes", async (req, res) => {
    try {
      const { id_log, id_user } = req.body;
      
      const [results] = await pool.query(
        "INSERT INTO `like`(id_log, id_user) VALUES(?, ?)",
        [id_log, id_user]
      );
      
      const [likeCriado] = await pool.query(
        "SELECT * FROM `like` WHERE id=?",
        results.insertId
      );
      res.status(201).json(likeCriado[0]);
    } catch (error) {
      console.error("Erro ao dar like:", error);
      if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).send("O usuário já deu like neste log.");
      }
      res.status(500).send("Erro interno do servidor.");
    }
});

app.delete("/likes", async (req, res) => {
    try {
      const { id_log, id_user } = req.query;
      
      const [results] = await pool.query(
        "DELETE FROM `like` WHERE id_log=? AND id_user=?",
        [id_log, id_user]
      );
  
      if (results.affectedRows === 0) {
          return res.status(404).send("Like não encontrado para exclusão.");
      }
      
      res.status(200).send("Like retirado com sucesso!");
    } catch (error) {
      console.error("Erro ao retirar like:", error);
      res.status(500).send("Erro interno do servidor.");
    }
});

// INICIALIZAÇÃO DO SERVIDOR
app.listen(3000, () => {
    console.log(`Servidor rodando na porta: http://localhost:3000`);
});