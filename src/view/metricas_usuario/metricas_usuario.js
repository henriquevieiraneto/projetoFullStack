// --- INÍCIO DA VERIFICAÇÃO DE AUTENTICAÇÃO ---
const usuarioLogado = localStorage.getItem('usuarioLogado');
let usuario; // Variável global para dados do usuário

if (!usuarioLogado) {
    // Se não houver dados no localStorage, redireciona para a tela de login
    console.warn("Usuário não autenticado. Redirecionando para o login.");
    // Caminho relativo para sair de /metricas_usuario/ e entrar em /login/
    window.location.href = '../login/login.html';
} else {
    // Tenta fazer o parse dos dados do usuário
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
// SÓ EXECUTA SE O USUÁRIO FOR VÁLIDO
// -------------------------------------------------------------------------

if (typeof usuario !== 'undefined' && usuario) {

    // URL Base da API (Seu servidor app.js)
    const API_URL = 'http://localhost:3000';
    let userId = usuario.id;
    let editingUserId = null; // Controla se estamos editando ou criando um usuário

    // ----------------------------------------------------
    // REFERÊNCIAS DE ELEMENTOS UI
    // ----------------------------------------------------
    const statusMessageDiv = document.getElementById('statusMessage'); 
    const loadingIndicator = document.getElementById('loadingIndicator'); 
    const userNameElement = document.getElementById('nome-usuario-metricas'); 
    
    // NOVOS Elementos para CRUD de Usuário
    const userModalEl = document.getElementById('user-crud-modal');
    let userModalInstance = null; // Instância do Modal Bootstrap
    const userForm = document.getElementById('user-form');
    const userModalTitle = document.getElementById('user-modal-title');
    const userTableBody = document.getElementById('user-table-body');
    const btnOpenUserModal = document.getElementById('btn-open-user-modal');

    // ----------------------------------------------------
    // FUNÇÕES DE UTILIDADE E UI
    // ----------------------------------------------------

    /**
     * Exibe uma mensagem de erro na UI.
     * @param {string} message Mensagem de erro.
     */
    const displayError = (message) => {
        if (statusMessageDiv) {
            // Assume classes Bootstrap ou CSS customizado
            statusMessageDiv.className = 'alert alert-danger p-3 mb-3'; 
            statusMessageDiv.textContent = `Erro: ${message}`;
            statusMessageDiv.classList.remove('hidden');
            setTimeout(() => { 
                if (statusMessageDiv) statusMessageDiv.classList.add('hidden'); 
            }, 5000);
        } else {
            console.error("Erro:", message); 
        }
    };

    /**
     * Esconde o indicador de carregamento.
     */
    const hideLoading = () => {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        // Mostra os containers
        const metricsContainer = document.getElementById('metricas-container');
        const logsRecentesContainer = document.getElementById('logs-recentes');
        const userManagementContainer = document.getElementById('user-management-container'); // NOVO
        if (metricsContainer) metricsContainer.classList.remove('hidden');
        if (logsRecentesContainer) logsRecentesContainer.classList.remove('hidden');
        if (userManagementContainer) userManagementContainer.classList.remove('hidden'); // NOVO
    };

    /**
     * Atualiza o texto de um elemento na UI pelo seu ID.
     */
    const updateElementText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    /**
     * Atualiza os cartões de métricas na UI.
     */
    function updateDashboardUI(metrics) {
        const data = { 
            total_logs: 0, 
            horas_trabalhadas: 0.0, 
            bugs_corrigidos: 0, 
            ...metrics 
        };

        updateElementText('metric-total-logs', data.total_logs);
        updateElementText('metric-total-bugs', data.bugs_corrigidos);
        updateElementText('metric-total-horas', `${(parseFloat(data.horas_trabalhadas) || 0).toFixed(1)}h`);
    }

    /**
     * Atualiza a seção "Seus Logs Mais Recentes" na UI.
     */
    function updateRecentActivitiesUI(logs) {
        const listElement = document.getElementById('logs-recentes'); 
        if (!listElement) return;

        listElement.innerHTML = ''; 

        if (!logs || logs.length === 0) {
            listElement.innerHTML = '<p class="alert alert-warning text-center">Nenhum log recente encontrado para este usuário.</p>';
            return;
        }

        logs.slice(0, 5).forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = 'metric-card mb-3'; 
            logItem.style.textAlign = 'left'; 

            const logDate = new Date(log.data_registro).toLocaleDateString('pt-BR');
            
            logItem.innerHTML = `
                <h6 class="mb-1">${log.titulo || 'Log Sem Título'} - <span class="badge bg-secondary">${log.categoria || 'Geral'}</span></h6>
                <p class="mb-1 small text-muted">${log.descricao_do_trabalho ? log.descricao_do_trabalho.substring(0, 100) + '...' : 'Sem descrição.'}</p>
                <small>Em: ${logDate}</small>
            `;
            listElement.appendChild(logItem);
        });
    }

    // ----------------------------------------------------
    // LÓGICA DE DADOS (Fetch da API Node.js/MySQL)
    // ----------------------------------------------------

    /**
     * Busca os dados de métricas e logs recentes do backend.
     */
    async function fetchMetricsAndLogs() {
        if (!userId) {
            displayError("ID do usuário não encontrado. Não é possível buscar dados.");
            hideLoading();
            return;
        }

        // 1. Buscar Métricas (Total)
        try {
            const responseMetrics = await fetch(`${API_URL}/metricas-usuario/${userId}`);
            if (!responseMetrics.ok) {
                 const errData = await responseMetrics.json().catch(() => ({}));
                 throw new Error(errData.message || `Erro HTTP ${responseMetrics.status}`);
            }
            const metrics = await responseMetrics.json();
            updateDashboardUI(metrics); // Atualiza os cards
        } catch (error) {
            console.error("Erro ao carregar métricas detalhadas:", error);
            displayError(`Não foi possível carregar as métricas: ${error.message}`);
            updateDashboardUI({}); // Mostra 0s se falhar
        }

        // 2. Buscar Logs Recentes (Filtrados por este usuário)
        try {
            const responseLogs = await fetch(`${API_URL}/logs?search=${encodeURIComponent(usuario.nome)}&quantidade=5&userId=${userId}`);
            if (!responseLogs.ok) {
                 const errData = await responseLogs.json().catch(() => ({}));
                 throw new Error(errData.message || `Erro HTTP ${responseLogs.status}`);
            }
            const logs = await responseLogs.json();
            
            const userLogs = logs.filter(log => log.usuario_nome === usuario.nome);
            
            updateRecentActivitiesUI(userLogs); // Atualiza a lista de logs

        } catch (error) {
            console.error("Erro ao carregar logs recentes:", error);
             const listElement = document.getElementById('logs-recentes');
             if(listElement) listElement.innerHTML = '<p class="alert alert-danger text-center small">Não foi possível carregar os logs recentes.</p>';
        }

        hideLoading(); // Garante que o loading suma
    }


    /**
     * Configura o botão de logout.
     */
    function setupLogoutButton() {
        const btnLogout = document.getElementById('btnLogout'); 
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                localStorage.removeItem('usuarioLogado'); 
                window.location.href = '../login/login.html';
            });
        }
    }

    // ====================================================
    // NOVO: LÓGICA DE CRUD DE USUÁRIOS
    // ====================================================
    
    /**
     * Busca todos os usuários da API e renderiza a tabela.
     */
    async function fetchUsers() {
        if (!userTableBody) return;
        userTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando usuários...</td></tr>';
        
        try {
            const response = await fetch(`${API_URL}/usuarios`);
            if (!response.ok) throw new Error("Falha ao buscar usuários.");
            const users = await response.json();
            renderUserTable(users);
        } catch (error) {
            console.error("Erro ao buscar usuários:", error);
            userTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar usuários.</td></tr>';
        }
    }

    /**
     * Renderiza a tabela de usuários no DOM.
     * @param {Array} users - Lista de usuários.
     */
    function renderUserTable(users) {
        if (!userTableBody) return;
        userTableBody.innerHTML = ''; // Limpa a tabela

        if (users.length === 0) {
            userTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.nome}</td>
                <td>${user.email}</td>
                <td>
                    <button class="btn btn-sm btn-warning btn-edit" data-id="${user.id}" data-nome="${user.nome}" data-email="${user.email}">
                        <i class="fas fa-pencil-alt"></i> Editar
                    </button>
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${user.id}" data-nome="${user.nome}">
                        <i class="fas fa-trash-alt"></i> Excluir
                    </button>
                </td>
            `;
            userTableBody.appendChild(tr);
        });

        // Adiciona listeners aos novos botões
        addUserTableListeners();
    }

    /**
     * Adiciona listeners aos botões de Editar e Excluir na tabela.
     */
    function addUserTableListeners() {
        // Botões de Edição
        document.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const nome = e.currentTarget.dataset.nome;
                const email = e.currentTarget.dataset.email;
                
                // Preenche o formulário no modal
                editingUserId = id;
                document.getElementById('user-nome').value = nome;
                document.getElementById('user-email').value = email;
                document.getElementById('user-senha').value = ''; // Senha não é preenchida por segurança
                document.getElementById('user-senha').placeholder = 'Deixe em branco para não alterar';
                
                userModalTitle.textContent = "Editar Usuário";
                userModalInstance.show();
            });
        });

        // Botões de Exclusão
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const nome = e.currentTarget.dataset.nome;
                
                // (O ideal seria usar um modal de confirmação)
                if (confirm(`Tem certeza que deseja excluir o usuário "${nome}" (ID: ${id})?`)) {
                    deleteUser(id);
                }
            });
        });
    }

    /**
     * Abre o modal para criar um novo usuário.
     */
    function openNewUserModal() {
        editingUserId = null; // Garante que está em modo de criação
        userForm.reset(); // Limpa o formulário
        document.getElementById('user-senha').placeholder = 'Senha obrigatória';
        userModalTitle.textContent = "Adicionar Novo Usuário";
        userModalInstance.show();
    }

    /**
     * Lida com a submissão do formulário de usuário (Criar ou Editar).
     */
    async function handleUserSubmit(event) {
        event.preventDefault();
        
        const nome = document.getElementById('user-nome').value;
        const email = document.getElementById('user-email').value;
        const senha = document.getElementById('user-senha').value; // Pode estar vazio (se editando)

        let url = '';
        let method = '';
        let body = {};

        if (editingUserId) {
            // Modo de Edição (PUT)
            url = `${API_URL}/usuarios/${editingUserId}`;
            method = 'PUT';
            body = { nome, email };
            // Só adiciona a senha no corpo se o usuário digitou uma nova
            if (senha) {
                body.senha = senha;
            }
        } else {
            // Modo de Criação (POST)
            url = `${API_URL}/cadastro`;
            method = 'POST';
            if (!senha) {
                displayError("Senha é obrigatória para criar um novo usuário.");
                return;
            }
            body = { nome, email, senha };
        }

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                 const errData = await response.json().catch(() => ({}));
                 throw new Error(errData.message || `Erro ${response.status}`);
            }

            userModalInstance.hide(); // Esconde o modal
            fetchUsers(); // Recarrega a tabela de usuários

        } catch (error) {
            console.error("Erro ao salvar usuário:", error);
            displayError(`Falha ao salvar usuário: ${error.message}`);
        }
    }

    /**
     * Exclui um usuário.
     */
    async function deleteUser(id) {
        try {
            const response = await fetch(`${API_URL}/usuarios/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                 const errData = await response.json().catch(() => ({}));
                 throw new Error(errData.message || `Erro ${response.status}`);
            }

            fetchUsers(); // Recarrega a tabela

        } catch (error) {
            console.error("Erro ao excluir usuário:", error);
            displayError(`Falha ao excluir usuário: ${error.message}`);
        }
    }

    // ----------------------------------------------------
    // INICIALIZAÇÃO DA APLICAÇÃO
    // ----------------------------------------------------
    
    document.addEventListener('DOMContentLoaded', () => {
        // Injeta o nome do usuário
        const userNameElement = document.getElementById('nome-usuario-metricas');
        if(userNameElement) userNameElement.textContent = usuario.nome;

        // Inicia o carregamento dos dados
        fetchMetricsAndLogs();
        fetchUsers(); // NOVO: Carrega a tabela de usuários
        
        // Configura o logout
        setupLogoutButton();

        // NOVO: Configura o Modal Bootstrap e os listeners do CRUD
        if (userModalEl) {
             userModalInstance = new bootstrap.Modal(userModalEl);
        }
        if (btnOpenUserModal) {
            btnOpenUserModal.addEventListener('click', openNewUserModal);
        }
        if (userForm) {
            userForm.addEventListener('submit', handleUserSubmit);
        }
    });

} // Fim do bloco 'if (usuario)'

