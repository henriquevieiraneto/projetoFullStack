// --- INÍCIO DA VERIFICAÇÃO DE AUTENTICAÇÃO ---
// Verifica se o usuário logou (usando a chave salva pelo login.js)
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
        if (typeof bootstrap === 'undefined') {
            console.error("Bootstrap JS não está carregado. Não é possível mostrar o modal.");
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
    // LÓGICA DO DASHBOARD (MÉTRICAS, LOGS, LIKES, FILTROS)
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

    // 3. FUNÇÃO PARA DAR/RETIRAR LIKE
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
                carregarLogs(getCurrentFilters()); // Recarrega
                return;
            }

            // Se falhar com 409 (Conflito), tenta retirar o like
            if (response.status === 409) {
                response = await fetch(`${url}?id_log=${logId}&id_user=${userId}`, {
                    method: "DELETE"
                });

                if (response.ok) { // Deslike bem-sucedido
                    console.log(`Like removido do log ${logId}`);
                    carregarLogs(getCurrentFilters()); // Recarrega
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

    // 4. ADICIONA EVENT LISTENER NOS BOTÕES DE LIKE
    function adicionarListenersLike() {
        if (!usuario || !usuario.id) {
             console.error("ID do usuário não definido para listeners de like.");
             return;
        }
        const userId = usuario.id;
        document.querySelectorAll('.btn-like').forEach(button => {
            // Limpa listeners antigos clonando o nó
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', function() {
                const logId = parseInt(this.getAttribute('data-log-id'));
                if (logId && userId) {
                    toggleLike(logId, userId);
                } else {
                    displayAlert("Erro: ID do Log ou ID do Usuário ausente.");
                }
            });
        });
    }
    
    // 5. FUNÇÕES DE EDIÇÃO E EXCLUSÃO DE LOG
    
    // INICIAR EDIÇÃO
    function iniciarEdicao(logId) {
        console.log(`Iniciando edição do log ${logId}`);
        // Redireciona para cad_logs.html passando o ID como parâmetro de URL
        // O cad_logs.js saberá ler este parâmetro
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

        // Handler para o clique de confirmação
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
                bootstrap.Modal.getInstance(modalElement).hide();
            }
        }
        
        confirmDeleteBtn.addEventListener('click', handleConfirm, { once: true });

        // Limpa o modal quando ele for fechado (pelo 'x' ou outro botão)
        modalElement.addEventListener('hidden.bs.modal', () => {
            confirmDeleteBtn.remove();
            if(closeButton) closeButton.style.display = 'inline-block';
            if(confirmButton) confirmButton.style.display = 'inline-block';
            confirmDeleteBtn.removeEventListener('click', handleConfirm);
        }, { once: true });
    }

    // 6. ADICIONA LISTENERS DE CRUD (Like, Edit, Delete)
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
    }

    // 7. FUNÇÃO AUXILIAR PARA OBTER OS FILTROS ATUAIS
    function getCurrentFilters() {
        const checkboxes = document.querySelectorAll('#filtro-area input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // 8. FUNÇÃO PRINCIPAL PARA CARREGAR O FEED DE LOGS (com filtros)
    async function carregarLogs(filtros = []) {
        const logsFeed = document.getElementById('logs-feed');
        if (!logsFeed) {
            console.error("Elemento 'logs-feed' não encontrado.");
            return;
        }
        logsFeed.innerHTML = '<div class="alert alert-info text-center">Carregando logs...</div>';

        let url = `${API_URL}/logs?pagina=1&quantidade=10&userId=${usuario.id}`;

        if (filtros.length > 0) {
            url += `&categoria=${encodeURIComponent(filtros[0])}`;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Falha ao buscar logs. Status: ${response.status}. Detalhe: ${errorText}`);
            }

            const logs = await response.json();
            logsFeed.innerHTML = ''; 

            if (logs.length === 0) {
                logsFeed.innerHTML = '<div class="alert alert-warning text-center">Nenhum log encontrado. Ajuste seus filtros ou crie um!</div>';
                return;
            }

            logs.forEach(log => {
                const horasLog = parseFloat(log.horas_trabalhadas) || 0;
                const avatarInitial = (log.usuario_nome ? log.usuario_nome.charAt(0) : '?').toUpperCase();

                const isLiked = log.usuarioCurtiu === true;
                const likeClass = isLiked ? 'text-danger' : 'text-muted';
                const heartIcon = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';

                // Define se os botões de Editar/Excluir devem aparecer
                // Compara o ID do usuário logado (armazenado na var 'usuario') com o ID do autor do log
                const botoesAdmin = (usuario.id === log.id_usuario) 
                    ? `
                        <button class="btn btn-sm btn-link text-warning p-0 ms-3 btn-edit" title="Editar Log" data-log-id="${log.id}">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="btn btn-sm btn-link text-danger p-0 ms-2 btn-delete" title="Excluir Log" data-log-id="${log.id}" data-log-titulo="${log.titulo || 'Log Sem Título'}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    ` 
                    : ''; // Se não for o dono, não mostra os botões

                const logElement = document.createElement('div');
                logElement.className = 'log-card'; 
                logElement.innerHTML = `
                    <div class="log-header">
                        <div class="user-avatar">${avatarInitial}</div>
                        <div>
                            <h6 class="mb-0 fw-bold">${log.usuario_nome || 'Usuário Desconhecido'}</h6>
                            <span class="small text-muted">${new Date(log.data_registro).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <!-- Botões de Admin (Editar/Excluir) aparecem aqui -->
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
                        <button class="btn btn-sm btn-link text-muted p-0 ms-3 btn-comment">
                           <i class="far fa-comment"></i> 0 comentários
                        </button>
                    </div>
                `;
                logsFeed.appendChild(logElement);
            });

            adicionarListenersCards(); // Atualizado para incluir Edit/Delete

        } catch (error) {
            console.error("Erro ao carregar logs:", error);
            logsFeed.innerHTML = '<div class="alert alert-danger text-center">Falha ao carregar o feed. Verifique se o servidor está rodando e conectado ao banco.</div>';
        }
    }

    // 9. FUNÇÃO PARA APLICAR FILTROS (Permite apenas 1 filtro por vez)
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
        // Garante que 'usuario' está definido
        if (!usuario) {
            console.error("Usuário não definido no DOMContentLoaded.");
            return;
        }

        // Injeta o nome do usuário
        const usuarioNomeEl = document.getElementById('usuarioNome');
        if (usuarioNomeEl) {
            usuarioNomeEl.textContent = usuario.nome;
            // Atualiza o avatar
             const initials = (usuario.nome ? usuario.nome.charAt(0) : '?').toUpperCase();
             const sidebarAvatar = document.querySelector('.sidebar .user-avatar');
             if(sidebarAvatar) sidebarAvatar.textContent = initials;
        } else {
            console.warn("Elemento 'usuarioNome' não encontrado.");
        }

        const userId = usuario.id;

        // Carrega os dados iniciais
        carregarMetricas(userId);
        carregarLogs(); // Sem filtros iniciais
        
        // Adiciona listeners para filtros
        document.querySelectorAll('#filtro-area input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', aplicarFiltros);
        });
    });

} // Fim do bloco 'if (usuario)'

