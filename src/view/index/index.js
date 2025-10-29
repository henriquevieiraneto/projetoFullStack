// --- INÍCIO DA VERIFICAÇÃO DE AUTENTICAÇÃO ---
// (Esta verificação NÃO usa Firebase, apenas localStorage)
const usuarioLogado = localStorage.getItem('usuarioLogado');
let usuario; // Variável global para armazenar os dados do usuário logado

if (!usuarioLogado) {
    // Se não houver dados no localStorage, redireciona para a tela de login
    console.warn("Usuário não autenticado. Redirecionando para o login.");
    // Caminho relativo correto para sair de /index/ e entrar em /login/
    window.location.href = '../login/login.html';
} else {
    // Somente continua a execução se o usuário estiver logado
    try {
        usuario = JSON.parse(usuarioLogado);
        // Verifica se os dados essenciais (id e nome) existem
        if (!usuario || !usuario.id || !usuario.nome) {
            throw new Error("Dados de usuário inválidos ou incompletos no localStorage.");
        }
        console.log("Usuário autenticado:", usuario.nome, "(ID:", usuario.id, ")");
    } catch (error) {
        console.error("Erro ao processar dados do usuário:", error);
        localStorage.removeItem('usuarioLogado'); // Limpa dados inválidos
        window.location.href = '../login/login.html'; // Força o login
    }
}
// --- FIM DA VERIFICAÇÃO DE AUTENTICAÇÃO ---

// -------------------------------------------------------------------------
// SÓ EXECUTA SE O USUÁRIO FOR VÁLIDO (autenticado)
// -------------------------------------------------------------------------

if (typeof usuario !== 'undefined' && usuario) {

    // URL Base da API (Onde seu servidor app.js está rodando)
    const API_URL = 'http://localhost:3000';
    const userId = usuario.id; // ID do usuário logado

    /**
     * Função para exibir mensagens customizadas (substitui alert)
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - 'success', 'danger', 'info', 'warning'.
     */
    function displayAlert(message, type = 'danger') {
        const modalElement = document.getElementById('customAlertModal');
        const modalMessage = document.getElementById('customAlertMessage');
        const modalTitle = document.getElementById('customAlertTitle');

        // Garante que a instância do Modal Bootstrap exista
        if (typeof bootstrap === 'undefined' || !modalElement) {
            console.error("Bootstrap JS não está carregado ou modal não encontrado. Não é possível mostrar o alerta.");
            return;
        }
        
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);

        const alertConfig = {
            success: { title: 'Sucesso!' },
            danger: { title: 'Erro!' },
            info: { title: 'Informação' },
            warning: { title: 'Atenção' }
        };
        const config = alertConfig[type] || alertConfig['danger'];

        if (modalMessage && modalTitle) {
            modalMessage.textContent = message;
            modalTitle.textContent = config.title;
            modalInstance.show();
        } else {
            console.error(`ALERTA (${type}): ${message}`); // Fallback
        }
    }
    
    // Fecha o modal de alerta customizado (Se existir o botão)
    const closeAlertButton = document.getElementById('closeCustomAlert');
    if (closeAlertButton) {
        closeAlertButton.addEventListener('click', () => {
            const modalElement = document.getElementById('customAlertModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) modalInstance.hide();
        });
    }

    // -------------------------------------------------------------------------
    // LÓGICA DO DASHBOARD (MÉTRICAS, LOGS, LIKES, FILTROS, CRUD)
    // -------------------------------------------------------------------------

    // 1. LOGOUT
    const btnLogout = document.getElementById('btnLogout');

    function handleLogout() {
        localStorage.removeItem('usuarioLogado'); // Limpa a sessão local
        window.location.href = '../login/login.html'; // Redireciona para o login
    }

    if (btnLogout) btnLogout.addEventListener('click', handleLogout);


    // 2. FUNÇÃO PARA CARREGAR AS MÉTRICAS DO USUÁRIO NA SIDEBAR
    async function carregarMetricas(userId) {
        const qtdLogsEl = document.getElementById('qtd-logs');
        const totalBugsEl = document.getElementById('total-bugs');
        const totalHorasEl = document.getElementById('total-horas');

        if (!qtdLogsEl || !totalBugsEl || !totalHorasEl) {
            console.warn("Elementos HTML das métricas não encontrados no DOM.");
            return;
        }

        const url = `${API_URL}/metricas-usuario/${userId}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Erro HTTP ${response.status} ao buscar métricas.`);
            const metricas = await response.json();

            // CORREÇÃO do 'toFixed'
            const horas = parseFloat(metricas.horas_trabalhadas) || 0;

            qtdLogsEl.textContent = metricas.total_logs || 0;
            totalBugsEl.textContent = metricas.bugs_corrigidos || 0;
            totalHorasEl.textContent = `${horas.toFixed(1)}h`; 

        } catch (error) {
            console.error("Erro ao carregar métricas:", error);
            qtdLogsEl.textContent = 'Erro';
            totalBugsEl.textContent = 'Erro';
            totalHorasEl.textContent = 'Erro';
        }
    }
    
    // 3. FUNÇÕES DE CRUD DE LOGS (Like, Edit, Delete)

    // LIKE/DESLIKE
    async function toggleLike(logId, userId) {
        const url = `${API_URL}/likes`;
        try {
            // Tenta dar o like primeiro
            let response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_log: logId, id_user: userId })
            });

            if (response.status === 201) { // Like adicionado
                console.log(`Like adicionado ao log ${logId}`);
                carregarLogs(getCurrentFilters());
                return;
            }

            // Se falhar com 409 (Conflito), tenta retirar o like
            if (response.status === 409) {
                response = await fetch(`${url}?id_log=${logId}&id_user=${userId}`, {
                    method: "DELETE"
                });

                if (response.ok) { // Deslike bem-sucedido
                    console.log(`Like removido do log ${logId}`);
                    carregarLogs(getCurrentFilters());
                    return;
                }
                throw new Error(`Falha ao retirar like: Status ${response.status}`);
            }

            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Falha na operação: Status ${response.status}`);

        } catch (error) {
            console.error("Erro na operação de like/deslike: ", error);
            displayAlert(`Erro na operação de Like: ${error.message}`);
        }
    }

    // INICIAR EDIÇÃO
    function iniciarEdicao(logId) {
        console.log(`Iniciando edição do log ${logId}`);
        // Redireciona para cad_logs.html passando o ID como parâmetro de URL
        window.location.href = `../cad_logs/cad_logs.html?editId=${logId}`;
    }

    // EXCLUIR LOG
    async function excluirLog(logId, logTitulo) {
        // Usa o modal customizado para confirmação
        displayAlert(`Tem certeza que deseja excluir o log: "${logTitulo}"? Esta ação é irreversível.`, 'danger');
        
        // Modifica o modal para lidar com a confirmação
        const modalElement = document.getElementById('customAlertModal');
        const confirmButton = modalElement.querySelector('.btn-primary'); // Assumindo que o botão OK é primário
        const closeButton = modalElement.querySelector('.btn-secondary');

        // Cria um novo botão de confirmação
        const confirmDeleteBtn = document.createElement('button');
        confirmDeleteBtn.type = 'button';
        confirmDeleteBtn.className = 'btn btn-danger';
        confirmDeleteBtn.textContent = 'Confirmar Exclusão';
        
        const modalFooter = modalElement.querySelector('.modal-footer');
        // Esconde o botão OK padrão
        if(closeButton) closeButton.style.display = 'none';
        if(confirmButton) confirmButton.style.display = 'none';
        
        modalFooter.appendChild(confirmDeleteBtn);

        async function handleConfirm() {
            try {
                const response = await fetch(`${API_URL}/logs/${logId}`, {
                    method: "DELETE"
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Erro ao excluir log.");
                
                displayAlert(data.message || "Log excluído com sucesso!", "success");
                carregarLogs(getCurrentFilters()); // Recarrega o feed

            } catch (error) {
                console.error("Erro ao excluir log:", error);
                displayAlert(error.message);
            } finally {
                // Limpa o modal
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) modalInstance.hide();
            }
        }
        
        confirmDeleteBtn.addEventListener('click', handleConfirm, { once: true });

        // Limpa o modal quando ele for fechado (pelo 'x' ou outro botão)
        modalElement.addEventListener('hidden.bs.modal', () => {
            confirmDeleteBtn.remove();
            if(closeButton) closeButton.style.display = 'inline-block';
            if(confirmButton) confirmButton.style.display = 'inline-block';
        }, { once: true });
    }

    // 4. LÓGICA DE COMENTÁRIOS (CRUD)

    /**
     * Busca e exibe os comentários para um log específico
     */
    async function carregarEExibirComentarios(logId, commentListElement) {
        commentListElement.innerHTML = '<p class="small text-center text-muted">Carregando comentários...</p>';
        
        try {
            const response = await fetch(`${API_URL}/logs/${logId}/comentarios`);
            if (!response.ok) throw new Error("Falha ao buscar comentários.");
            
            const comentarios = await response.json();
            
            if (comentarios.length === 0) {
                commentListElement.innerHTML = '<p class="small text-center text-muted">Nenhum comentário ainda.</p>';
                return;
            }

            commentListElement.innerHTML = ''; 
            
            comentarios.forEach(comment => {
                const avatarInitial = (comment.usuario_nome ? comment.usuario_nome.charAt(0) : '?').toUpperCase();
                const commentDate = new Date(comment.data_comentario).toLocaleString('pt-BR', { timeStyle: 'short', dateStyle: 'short'});

                // Botões de ação do comentário (Editar/Excluir)
                let commentActions = '';
                if (comment.id_usuario === usuario.id) {
                    commentActions = `
                        <div class="comment-actions">
                            <button class="btn-action btn-edit-comment" data-comment-id="${comment.id}" title="Editar">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn-action btn-delete-comment" data-comment-id="${comment.id}" title="Excluir">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    `;
                }

                const commentEl = document.createElement('div');
                commentEl.className = 'comment-card';
                commentEl.innerHTML = `
                    <div class="comment-avatar">${avatarInitial}</div>
                    <div class="comment-content">
                        ${commentActions}
                        <div class="comment-header">
                            <span class="user-name">${comment.usuario_nome || 'Usuário'}</span>
                            <span class="comment-date small">${commentDate}</span>
                        </div>
                        <p class="comment-body" id="comment-body-${comment.id}">${comment.comentario}</p>
                    </div>
                `;
                commentListElement.appendChild(commentEl);
            });

            // Adiciona listeners aos botões de editar/excluir comentários
            adicionarListenersComentariosCRUD(logId);

        } catch (error) {
            console.error("Erro ao carregar comentários:", error);
            commentListElement.innerHTML = '<p class="small text-center text-danger">Erro ao carregar comentários.</p>';
        }
    }

    /**
     * Lida com o envio de um novo comentário
     */
    async function handleCommentSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const logId = form.dataset.logId;
        const input = form.querySelector('.comment-input');
        const comentario = input.value.trim();
        const btn = form.querySelector('.btn-submit-comment');

        if (!comentario || !logId) return;
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/logs/${logId}/comentarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_usuario: usuario.id,
                    comentario: comentario
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || "Erro ao enviar comentário.");
            }

            input.value = ''; 
            // Recarrega os logs (para atualizar a contagem de comentários no card principal)
            carregarLogs(getCurrentFilters()); 
            
        } catch (error) {
            console.error("Erro ao enviar comentário:", error);
            displayAlert(`Erro ao enviar comentário: ${error.message}`);
        } finally {
            btn.disabled = false;
        }
    }

    /**
     * Lida com o clique em "Editar Comentário"
     */
    async function handleEditComment(commentId, logId) {
        const commentBodyEl = document.getElementById(`comment-body-${commentId}`);
        if (!commentBodyEl) return;
        
        const currentText = commentBodyEl.textContent;
        
        // (Solução com Prompt)
        const novoTexto = prompt("Edite seu comentário:", currentText);

        if (novoTexto && novoTexto.trim() !== '' && novoTexto !== currentText) {
            // Tenta atualizar no backend
            try {
                const response = await fetch(`${API_URL}/comentarios/${commentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        comentario: novoTexto,
                        id_usuario: usuario.id // Envia o ID do usuário para verificação no backend
                    })
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Erro ao editar comentário.");

                // Sucesso: Recarrega a seção de comentários
                const commentListElement = document.getElementById(`comment-list-${logId}`);
                if (commentListElement) {
                    carregarEExibirComentarios(logId, commentListElement);
                }

            } catch (error) {
                console.error("Erro ao editar comentário:", error);
                displayAlert(`Falha ao editar: ${error.message}`);
            }
        }
    }
    
    /**
     * Lida com o clique em "Excluir Comentário"
     */
    async function handleDeleteComment(commentId, logId) {
        // Reutiliza o modal de alerta para confirmação
        displayAlert("Tem certeza que deseja excluir este comentário?", 'danger');
        
        const modalElement = document.getElementById('customAlertModal');
        const confirmButton = modalElement.querySelector('.btn-primary'); 
        const closeButton = modalElement.querySelector('.btn-secondary');
        const modalFooter = modalElement.querySelector('.modal-footer');
        
        // Cria o botão de confirmação de exclusão
        const confirmDeleteBtn = document.createElement('button');
        confirmDeleteBtn.type = 'button';
        confirmDeleteBtn.className = 'btn btn-danger';
        confirmDeleteBtn.textContent = 'Confirmar Exclusão';
        
        if(closeButton) closeButton.style.display = 'none';
        if(confirmButton) confirmButton.style.display = 'none';
        modalFooter.appendChild(confirmDeleteBtn);

        async function handleConfirm() {
            try {
                const response = await fetch(`${API_URL}/comentarios/${commentId}`, {
                    method: "DELETE",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_usuario: usuario.id }) // Envia ID para segurança
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Erro ao excluir comentário.");
                
                displayAlert(data.message || "Comentário excluído!", "success");
                
                // Recarrega os logs (para atualizar a contagem de comentários no card principal)
                carregarLogs(getCurrentFilters()); 

            } catch (error) {
                console.error("Erro ao excluir comentário:", error);
                displayAlert(error.message);
            } finally {
                bootstrap.Modal.getInstance(modalElement).hide();
            }
        }
        
        confirmDeleteBtn.addEventListener('click', handleConfirm, { once: true });

        modalElement.addEventListener('hidden.bs.modal', () => {
            confirmDeleteBtn.remove();
            if(closeButton) closeButton.style.display = 'inline-block';
            if(confirmButton) confirmButton.style.display = 'inline-block';
        }, { once: true });
    }

    /**
     * Adiciona listeners aos botões de CRUD dos comentários
     */
    function adicionarListenersComentariosCRUD(logId) {
         if (!usuario || !usuario.id) return;

        // Listeners de Edição de Comentário
        document.querySelectorAll(`#comment-list-${logId} .btn-edit-comment`).forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function() {
                const commentId = parseInt(this.dataset.commentId);
                handleEditComment(commentId, logId);
            });
        });
        
        // Listeners de Exclusão de Comentário
        document.querySelectorAll(`#comment-list-${logId} .btn-delete-comment`).forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function() {
                const commentId = parseInt(this.dataset.commentId);
                handleDeleteComment(commentId, logId);
            });
        });
    }

    // 5. ADICIONA LISTENERS (Like, Edit Log, Delete Log, Toggle Comentários, Submit Comentário)
    function adicionarListenersCards() {
        if (!usuario || !usuario.id) return;
        const currentUserId = usuario.id;

        document.querySelectorAll('.btn-like').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function() {
                const logId = parseInt(this.getAttribute('data-log-id'));
                toggleLike(logId, currentUserId);
            });
        });
        
        document.querySelectorAll('.btn-edit').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function() {
                const logId = parseInt(this.getAttribute('data-log-id'));
                iniciarEdicao(logId);
            });
        });
        
        document.querySelectorAll('.btn-delete').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function() {
                const logId = parseInt(this.getAttribute('data-log-id'));
                const logTitulo = this.getAttribute('data-log-titulo') || "Log sem título";
                excluirLog(logId, logTitulo);
            });
        });

        // Adiciona listeners para Abrir/Fechar Comentários
        document.querySelectorAll('.btn-comment').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                const logId = this.dataset.logId;
                const section = document.getElementById(`comments-section-${logId}`);
                const list = document.getElementById(`comment-list-${logId}`);
                
                if (section && list) {
                    // Alterna a visibilidade
                    const isHidden = section.style.display === 'none' || section.style.display === '';
                    section.style.display = isHidden ? 'block' : 'none';
                    
                    // Se estiver abrindo, carrega os comentários
                    if (isHidden) {
                        carregarEExibirComentarios(logId, list);
                    }
                }
            });
        });

        // Adiciona listeners para Forms de Comentário
        document.querySelectorAll('.comment-form').forEach(form => {
            // Remove listener antigo se houver (embora cloneNode deva resolver)
            form.removeEventListener('submit', handleCommentSubmit);
            form.addEventListener('submit', handleCommentSubmit);
        });
    }

    // 6. FUNÇÃO AUXILIAR PARA OBTER OS FILTROS ATUAIS
    function getCurrentFilters() {
        const checkboxes = document.querySelectorAll('#filtro-area input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // 7. FUNÇÃO PRINCIPAL PARA CARREGAR O FEED DE LOGS
    async function carregarLogs(filtros = []) {
        const logsFeed = document.getElementById('logs-feed');
        if (!logsFeed) return;
        
        logsFeed.innerHTML = '<div class="alert alert-info text-center">Carregando logs...</div>';

        // O app.js (Rota 11) agora inclui comentarios_count
        let url = `${API_URL}/logs?pagina=1&quantidade=10&userId=${userId}`;

        if (filtros.length > 0) {
            url += `&categoria=${encodeURIComponent(filtros[0])}`;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Falha na conexão com o servidor.');

            const logs = await response.json();
            logsFeed.innerHTML = ''; 

            if (logs.length === 0) {
                logsFeed.innerHTML = '<div class="alert alert-warning text-center">Nenhum log encontrado. Crie um!</div>';
                return;
            }

            logs.forEach(log => {
                const horasLog = parseFloat(log.horas_trabalhadas) || 0;
                const avatarInitial = (log.usuario_nome ? log.usuario_nome.charAt(0) : '?').toUpperCase();
                
                const isLiked = log.usuarioCurtiu === true;
                const likeClass = isLiked ? 'text-danger' : 'text-muted';
                const heartIcon = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
                
                const commentCount = log.comentarios_count || 0;

                const botoesAdmin = (usuario.id === log.id_usuario) 
                    ? `
                        <button class="btn btn-sm btn-link text-warning p-0 ms-3 btn-edit" title="Editar Log" data-log-id="${log.id}">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="btn btn-sm btn-link text-danger p-0 ms-2 btn-delete" title="Excluir Log" data-log-id="${log.id}" data-log-titulo="${log.titulo || 'Log Sem Título'}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    ` 
                    : ''; 

                const logElement = document.createElement('div');
                logElement.className = 'log-card'; 
                logElement.innerHTML = `
                    <div class="log-header">
                        <div class="user-avatar">${avatarInitial}</div>
                        <div>
                            <h6 class="mb-0 fw-bold">${log.usuario_nome || 'Usuário Desconhecido'}</h6>
                            <span class="small text-muted">${new Date(log.data_registro).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div class="ms-auto">
                            ${botoesAdmin}
                        </div>
                    </div>

                    <h5 class="mt-2 mb-1">${log.titulo || 'Log Sem Título'}
                        <span class="badge bg-primary ms-2">${log.categoria || 'Sem Categoria'}</span>
                    </h5>

                    <p class="small">${log.descricao_do_trabalho || 'Nenhuma descrição fornecida.'}</p>

                    <div class="log-metrics-detail">
                        <span>🕒 ${horasLog.toFixed(1)}h</span>
                        <span>✍️ ${log.linhas_codigo || 0} linhas</span>
                        <span>🐛 ${log.bugs_corrigidos || 0} bugs corrigidos</span>
                    </div>

                    <div class="log-actions mt-2 d-flex align-items-center">
                        <button class="btn btn-sm btn-link p-0 btn-like ${likeClass}" data-log-id="${log.id}">
                            ${heartIcon} ${log.likes_count || 0}
                        </button>
                        <button class="btn btn-sm btn-link text-muted p-0 ms-3 btn-comment" data-log-id="${log.id}">
                           <i class="far fa-comment"></i> ${commentCount} comentários
                        </button>
                    </div>

                    <!-- Seção de Comentários (Oculta) -->
                    <div class="comment-section" id="comments-section-${log.id}" style="display: none;">
                        <div class="comment-list" id="comment-list-${log.id}">
                            <!-- Comentários serão carregados aqui -->
                        </div>
                        <form class="comment-form" data-log-id="${log.id}">
                            <input type="text" class="form-control form-control-sm comment-input" placeholder="Escreva um comentário..." required>
                            <button type="submit" class="btn btn-sm btn-primary btn-submit-comment">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </form>
                    </div>
                `;
                logsFeed.appendChild(logElement);
            });

            adicionarListenersCards(); // Atualizado para incluir Edit/Delete/Comentários

        } catch (error) {
            console.error("Erro ao carregar logs:", error);
            logsFeed.innerHTML = '<div class="alert alert-danger text-center">Falha ao carregar o feed. Verifique se o servidor está rodando.</div>';
        }
    }

    // 8. FUNÇÃO PARA APLICAR FILTROS
    function aplicarFiltros(event) {
        const checkboxes = document.querySelectorAll('#filtro-area input[type="checkbox"]');
        const changedCheckbox = event.target;

        if (changedCheckbox.checked) {
            checkboxes.forEach(cb => {
                if (cb !== changedCheckbox) {
                    cb.checked = false;
                }
            });
        }
        carregarLogs(getCurrentFilters());
    }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    document.addEventListener('DOMContentLoaded', () => {
        if (!usuario) return; 
        
        const usuarioNomeEl = document.getElementById('usuarioNome');
        if (usuarioNomeEl) {
            usuarioNomeEl.textContent = usuario.nome;
             const initials = (usuario.nome ? usuario.nome.charAt(0) : '?').toUpperCase();
             const sidebarAvatar = document.querySelector('.sidebar .user-avatar');
             if(sidebarAvatar) sidebarAvatar.textContent = initials;
        }

        carregarMetricas(userId);
        carregarLogs(); // Carga inicial
        
        document.querySelectorAll('#filtro-area input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', aplicarFiltros);
        });
    });

} // Fim do bloco 'if (usuario)'

