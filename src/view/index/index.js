// --- INÍCIO DA VERIFICAÇÃO DE AUTENTICAÇÃO ---
const usuarioLogado = localStorage.getItem('usuarioLogado');
let usuario; // Variável global para armazenar os dados do usuário logado

if (!usuarioLogado) {
    console.warn("Usuário não autenticado. Redirecionando para o login.");
    window.location.href = '../login/login.html';
} else {
    try {
        usuario = JSON.parse(usuarioLogado);
        if (!usuario || !usuario.id || !usuario.nome) {
            throw new Error("Dados de usuário inválidos no localStorage.");
        }
    } catch (error) {
        console.error("Erro ao processar dados do usuário:", error);
        localStorage.removeItem('usuarioLogado'); 
        window.location.href = '../login/login.html'; 
    }
}
// --- FIM DA VERIFICAÇÃO DE AUTENTICAÇÃO ---

// -------------------------------------------------------------------------
// SÓ EXECUTA SE O USUÁRIO FOR VÁLIDO (autenticado)
// -------------------------------------------------------------------------

if (typeof usuario !== 'undefined' && usuario) {

    const API_URL = 'http://localhost:3000';
    const userId = usuario.id;

    /**
     * Função para exibir mensagens customizadas (Modal Bootstrap)
     */
    function displayAlert(message, type = 'danger') {
        const modalElement = document.getElementById('customAlertModal');
        const modalMessage = document.getElementById('customAlertMessage');
        const modalTitle = document.getElementById('customAlertTitle');
        
        if (typeof bootstrap === 'undefined' || !modalElement) {
            console.error("Bootstrap JS não está carregado ou modal não encontrado.");
            return;
        }
        
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
        const config = (type === 'success') ? { title: 'Sucesso!' } : { title: 'Erro!' };

        if (modalMessage && modalTitle) {
            modalMessage.textContent = message;
            modalTitle.textContent = config.title;
            modalInstance.show();
        } else {
            console.error(`ALERTA (${type}): ${message}`);
        }
    }
    
    // Fecha o modal de alerta customizado
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
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('usuarioLogado'); 
            window.location.href = '../login/login.html'; 
        });
    }

    // 2. CARREGAR MÉTRICAS (Sidebar)
    async function carregarMetricas(userId) {
        const url = `${API_URL}/metricas-usuario/${userId}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
            const metricas = await response.json();

            const horas = parseFloat(metricas.horas_trabalhadas) || 0;
            document.getElementById('qtd-logs').textContent = metricas.total_logs || 0;
            document.getElementById('total-bugs').textContent = metricas.bugs_corrigidos || 0;
            document.getElementById('total-horas').textContent = `${horas.toFixed(1)}h`; 

        } catch (error) {
            console.error("Erro ao carregar métricas:", error);
        }
    }
    
    // 3. FUNÇÕES DE CRUD DE LOGS (Like, Edit, Delete)

    // LIKE/DESLIKE
    async function toggleLike(logId, userId) {
        const url = `${API_URL}/likes`;
        try {
            let response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_log: logId, id_user: userId })
            });
            if (response.status === 409) {
                response = await fetch(`${url}?id_log=${logId}&id_user=${userId}`, {
                    method: "DELETE"
                });
            }
            if (!response.ok) throw new Error("Falha ao atualizar like.");
            carregarLogs(getCurrentFilters()); // Recarrega
        } catch (error) {
            console.error("Erro na operação de like/deslike: ", error);
            displayAlert(`Erro na operação de Like: ${error.message}`);
        }
    }

    // INICIAR EDIÇÃO
    function iniciarEdicao(logId) {
        window.location.href = `../cad_logs/cad_logs.html?editId=${logId}`;
    }

    // EXCLUIR LOG
    async function excluirLog(logId, logTitulo) {
        displayAlert(`Tem certeza que deseja excluir o log: "${logTitulo}"? Esta ação é irreversível.`, 'danger');
        
        const modalElement = document.getElementById('customAlertModal');
        const confirmButton = modalElement.querySelector('.btn-primary'); 
        const closeButton = modalElement.querySelector('.btn-secondary');
        const confirmDeleteBtn = document.createElement('button');
        confirmDeleteBtn.type = 'button';
        confirmDeleteBtn.className = 'btn btn-danger';
        confirmDeleteBtn.textContent = 'Confirmar Exclusão';
        
        const modalFooter = modalElement.querySelector('.modal-footer');
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
                carregarLogs(getCurrentFilters()); 

            } catch (error) {
                console.error("Erro ao excluir log:", error);
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
                // CORREÇÃO: Adicionamos o logId aos data-attributes dos botões de comentário
                if (comment.id_usuario === usuario.id) {
                    commentActions = `
                        <div class="comment-actions">
                            <button class="btn-action btn-edit-comment" data-log-id="${logId}" data-comment-id="${comment.id}" title="Editar">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn-action btn-delete-comment" data-log-id="${logId}" data-comment-id="${comment.id}" title="Excluir">
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

            // REMOVIDO: Não precisamos mais adicionar listeners aqui, 
            // pois a delegação de eventos no DOMContentLoaded cuidará disso.
            // adicionarListenersComentariosCRUD(logId); 

        } catch (error) {
            console.error("Erro ao carregar comentários:", error);
            commentListElement.innerHTML = '<p class="small text-center text-danger">Erro ao carregar comentários.</p>';
        }
    }

    /**
     * Lida com o envio de um novo comentário
     */
    async function handleCommentSubmit(formElement) { // Recebe o <form>
        const logId = formElement.dataset.logId;
        const input = formElement.querySelector('.comment-input');
        const comentario = input.value.trim();
        const btn = formElement.querySelector('.btn-submit-comment');

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
            carregarLogs(getCurrentFilters()); // Recarrega o log (para atualizar contagem e lista)
            
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
        const novoTexto = prompt("Edite seu comentário:", currentText); // Usando prompt()

        if (novoTexto && novoTexto.trim() !== '' && novoTexto !== currentText) {
            try {
                const response = await fetch(`${API_URL}/comentarios/${commentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        comentario: novoTexto,
                        id_usuario: usuario.id 
                    })
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Erro ao editar comentário.");

                // Recarrega a seção de comentários
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
        displayAlert("Tem certeza que deseja excluir este comentário?", 'danger');
        
        const modalElement = document.getElementById('customAlertModal');
        const confirmButton = modalElement.querySelector('.btn-primary'); 
        const closeButton = modalElement.querySelector('.btn-secondary');
        const modalFooter = modalElement.querySelector('.modal-footer');
        
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
                    body: JSON.stringify({ id_usuario: usuario.id }) 
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Erro ao excluir comentário.");
                
                displayAlert(data.message || "Comentário excluído!", "success");
                carregarLogs(getCurrentFilters()); // Recarrega os logs (para atualizar a contagem)

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

    // REMOVIDO: function adicionarListenersComentariosCRUD(logId) { ... }
    // REMOVIDO: function adicionarListenersCards() { ... }

    // 5. FUNÇÃO AUXILIAR PARA OBTER OS FILTROS ATUAIS
    function getCurrentFilters() {
        const checkboxes = document.querySelectorAll('#filtro-area input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // 6. FUNÇÃO PRINCIPAL PARA CARREGAR O FEED DE LOGS
    async function carregarLogs(filtros = []) {
        const logsFeed = document.getElementById('logs-feed');
        if (!logsFeed) return;
        
        logsFeed.innerHTML = '<div class="alert alert-info text-center">Carregando logs...</div>';
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

            // REMOVIDO: Não precisamos mais chamar a função de adicionar listeners
            // adicionarListenersCards(); 

        } catch (error) {
            console.error("Erro ao carregar logs:", error);
            logsFeed.innerHTML = '<div class="alert alert-danger text-center">Falha ao carregar o feed. Verifique se o servidor está rodando.</div>';
        }
    }

    // 7. FUNÇÃO PARA APLICAR FILTROS
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
        
        // (NOVO) Listener de Delegação de Eventos para o Feed
        const logsFeedContainer = document.getElementById('logs-feed');
        if (logsFeedContainer) {
            
            // Listener para CLIQUES
            logsFeedContainer.addEventListener('click', (event) => {
                const target = event.target;
                
                // Delegação para Botão LIKE (Log)
                const likeBtn = target.closest('.btn-like');
                if (likeBtn) {
                    event.preventDefault();
                    const logId = parseInt(likeBtn.dataset.logId);
                    if (logId) toggleLike(logId, usuario.id);
                    return;
                }

                // Delegação para Botão EDITAR (Log)
                const editBtn = target.closest('.btn-edit');
                if (editBtn) {
                    event.preventDefault();
                    const logId = parseInt(editBtn.dataset.logId);
                    if (logId) iniciarEdicao(logId);
                    return;
                }

                // Delegação para Botão EXCLUIR (Log)
                const deleteBtn = target.closest('.btn-delete');
                if (deleteBtn) {
                    event.preventDefault();
                    const logId = parseInt(deleteBtn.dataset.logId);
                    const logTitulo = deleteBtn.dataset.logTitulo || "Log sem título";
                    if (logId) excluirLog(logId, logTitulo);
                    return;
                }

                // Delegação para Botão EXPANDIR COMENTÁRIOS
                const commentToggleBtn = target.closest('.btn-comment');
                if (commentToggleBtn) {
                    event.preventDefault();
                    const logId = commentToggleBtn.dataset.logId;
                    const section = document.getElementById(`comments-section-${logId}`);
                    const list = document.getElementById(`comment-list-${logId}`);
                    
                    if (section && list) {
                        const isHidden = section.style.display === 'none' || section.style.display === '';
                        section.style.display = isHidden ? 'block' : 'none';
                        if (isHidden) {
                            carregarEExibirComentarios(logId, list);
                        }
                    }
                    return;
                }

                // Delegação para Botão EDITAR (Comentário)
                const editCommentBtn = target.closest('.btn-edit-comment');
                if (editCommentBtn) {
                    event.preventDefault();
                    const commentId = parseInt(editCommentBtn.dataset.commentId);
                    const logId = parseInt(editCommentBtn.dataset.logId);
                    if (commentId && logId) handleEditComment(commentId, logId);
                    return;
                }

                // Delegação para Botão EXCLUIR (Comentário)
                const deleteCommentBtn = target.closest('.btn-delete-comment');
                if (deleteCommentBtn) {
                    event.preventDefault();
                    const commentId = parseInt(deleteCommentBtn.dataset.commentId);
                    const logId = parseInt(deleteCommentBtn.dataset.logId);
                    if (commentId && logId) handleDeleteComment(commentId, logId);
                    return;
                }
            });

            // Listener para SUBMISSÃO DE FORMULÁRIO DE COMENTÁRIO
            logsFeedContainer.addEventListener('submit', (event) => {
                 const form = event.target;
                 if (form.classList.contains('comment-form')) {
                     event.preventDefault();
                     handleCommentSubmit(form); // Passa o elemento <form>
                 }
            });
        }
    });

} // Fim do bloco 'if (usuario)'

