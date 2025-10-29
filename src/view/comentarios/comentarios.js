// --- INÍCIO DA VERIFICAÇÃO DE AUTENTICAÇÃO ---
const usuarioLogado = localStorage.getItem('usuarioLogado');
let usuario; 

if (!usuarioLogado) {
    console.warn("Usuário não autenticado. Redirecionando para o login.");
    window.location.href = '../login/login.html';
} else {
    try {
        usuario = JSON.parse(usuarioLogado);
        if (!usuario || !usuario.id || !usuario.nome) {
            throw new Error("Dados de usuário inválidos no localStorage.");
        }
        console.log("Usuário autenticado:", usuario.nome);
    } catch (error) {
        console.error("Erro ao processar dados do usuário:", error);
        localStorage.removeItem('usuarioLogado'); 
        window.location.href = '../login/login.html'; 
    }
}
// --- FIM DA VERIFICAÇÃO DE AUTENTICAÇÃO ---

// -------------------------------------------------------------------------
// SÓ EXECUTA SE O USUÁRIO FOR VÁLIDO
// -------------------------------------------------------------------------

if (typeof usuario !== 'undefined' && usuario) {

    // URL Base da API (Seu servidor app.js)
    const API_URL = 'http://localhost:3000';
    let logId = null; // ID do log que estamos vendo

    // --- FUNÇÕES DE UTILIDADE ---
    
    function displayMessage(message, type = 'danger') {
        const messageBox = document.getElementById('message-box'); 
        if (messageBox) {
            messageBox.textContent = message;
            messageBox.className = `p-2 rounded text-center text-sm ${
                type === 'success' ? 'alert alert-success' : 'alert alert-danger'
            }`;
            messageBox.classList.remove('hidden'); 
            setTimeout(() => {
                 if (messageBox) messageBox.classList.add('hidden');
            }, 5000);
        } else {
            console.error(`ALERTA (${type}): ${message}`);
        }
    }

    // --- LÓGICA DA PÁGINA DE COMENTÁRIOS ---

    /**
     * Carrega os detalhes do Log principal (Título, Descrição)
     */
    async function carregarDetalhesLog(id) {
        const loadingDiv = document.getElementById('loading-log');
        const contentDiv = document.getElementById('log-detalhe-content');
        
        try {
            const response = await fetch(`${API_URL}/logs/${id}`);
            if (!response.ok) throw new Error("Log não encontrado");
            const log = await response.json();

            document.getElementById('log-titulo').textContent = log.titulo || "Log Sem Título";
            document.getElementById('log-descricao').textContent = log.descricao_do_trabalho || "Sem descrição.";
            document.getElementById('log-categoria').textContent = log.categoria || "Geral";

            loadingDiv.classList.add('hidden');
            contentDiv.classList.remove('hidden');

        } catch (error) {
            console.error("Erro ao carregar detalhes do log:", error);
            loadingDiv.innerHTML = '<p class="text-center text-danger">Erro ao carregar o log.</p>';
        }
    }

    /**
     * Carrega a lista de comentários da API
     */
    async function carregarComentarios(id) {
        const listaComentarios = document.getElementById('lista-comentarios');
        listaComentarios.innerHTML = '<p class="alert alert-info text-center">Carregando comentários...</p>';

        try {
            const response = await fetch(`${API_URL}/logs/${id}/comentarios`);
            if (!response.ok) throw new Error("Falha ao buscar comentários.");
            const comentarios = await response.json();

            if (comentarios.length === 0) {
                listaComentarios.innerHTML = '<p class="alert alert-secondary text-center">Nenhum comentário ainda. Seja o primeiro!</p>';
                return;
            }

            listaComentarios.innerHTML = ''; // Limpa
            
            comentarios.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.className = 'comment-card';
                
                const avatarInitial = (comment.usuario_nome ? comment.usuario_nome.charAt(0) : '?').toUpperCase();
                const commentDate = new Date(comment.data_comentario).toLocaleString('pt-BR');

                commentEl.innerHTML = `
                    <div class="comment-avatar">${avatarInitial}</div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="user-name">${comment.usuario_nome || 'Usuário'}</span>
                            <span class="comment-date small">${commentDate}</span>
                        </div>
                        <p class="comment-body">${comment.comentario}</p>
                    </div>
                `;
                listaComentarios.appendChild(commentEl);
            });

        } catch (error) {
            console.error("Erro ao carregar comentários:", error);
            listaComentarios.innerHTML = '<p class="alert alert-danger text-center">Não foi possível carregar os comentários.</p>';
        }
    }

    /**
     * Lida com o envio do novo comentário
     */
    async function handleCommentSubmit(event) {
        event.preventDefault();
        
        const comentarioInput = document.getElementById('comentario-texto');
        const comentario = comentarioInput.value.trim();
        const btnSubmit = event.target.querySelector('button[type="submit"]');

        if (!comentario) {
            displayMessage("O comentário não pode estar vazio.", "danger");
            return;
        }
        if (!logId) {
            displayMessage("Erro: ID do Log não encontrado.", "danger");
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Enviando...';

        try {
            const response = await fetch(`${API_URL}/logs/${logId}/comentarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_usuario: usuario.id,
                    comentario: comentario
                })
            });

            const data = await response.json();

            if (response.ok) {
                displayMessage("Comentário enviado com sucesso!", "success");
                comentarioInput.value = ''; // Limpa o campo
                carregarComentarios(logId); // Recarrega a lista de comentários
            } else {
                throw new Error(data.message || "Erro ao salvar comentário.");
            }

        } catch (error) {
            console.error("Erro ao enviar comentário:", error);
            displayMessage(error.message, "danger");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fas fa-paper-plane me-1"></i> Enviar Comentário';
        }
    }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    document.addEventListener('DOMContentLoaded', () => {
        // Pega o ID do Log da URL
        const urlParams = new URLSearchParams(window.location.search);
        logId = urlParams.get('logId');

        if (!logId) {
            displayError("Nenhum ID de log fornecido na URL.");
            document.getElementById('logs-recentes').innerHTML = '';
            document.getElementById('log-detalhe-content').innerHTML = '';
            return;
        }

        // Carrega os dados
        carregarDetalhesLog(logId);
        carregarComentarios(logId);

        // Adiciona listener ao formulário
        const form = document.getElementById('comment-form');
        if (form) {
            form.addEventListener('submit', handleCommentSubmit);
        }
    });

} // Fim do bloco 'if (usuario)'
