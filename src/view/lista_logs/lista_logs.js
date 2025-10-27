// --- INÍCIO DA VERIFICAÇÃO DE AUTENTICAÇÃO ---
const usuarioLogado = localStorage.getItem('usuarioLogado');
let usuario; // Variável global para armazenar os dados do usuário logado

if (!usuarioLogado) {
    // Se não houver dados no localStorage, redireciona para a tela de login
    console.warn("Usuário não autenticado. Redirecionando para o login.");
    // Caminho relativo correto para sair de /lista_logs/ e entrar em /login/
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
// FUNÇÕES UTILITÁRIAS E GLOBAIS (só executa se 'usuario' for válido)
// -------------------------------------------------------------------------

if (typeof usuario !== 'undefined' && usuario) {

    // Variáveis de estado para controle de paginação e pesquisa
    let paginaAtual = 1;
    const logsPorPagina = 10;
    let searchTimeout; // Para debounce na pesquisa

    /**
     * Função para exibir mensagens customizadas (substitui alert)
     * Implementação simplificada para este arquivo (sem modal Bootstrap complexo)
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - 'success', 'danger', 'info', 'warning'.
     */
    function displayAlert(message, type = 'danger') {
        const messageBox = document.getElementById('message-box'); // Assume <div id="message-box"> no HTML
        if (messageBox) {
            messageBox.textContent = message;
            messageBox.className = `p-3 rounded-lg text-center text-sm ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
            messageBox.classList.remove('hidden');
            setTimeout(() => {
                 messageBox.classList.add('hidden');
            }, 5000);
        } else {
            console.error(`ALERTA (${type}):`, message);
        }
    }
    
    // 1. LOGOUT
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('usuarioLogado'); // Limpa a sessão local
            window.location.href = '../login/login.html'; // Redireciona para o login
        });
    }

    // 2. FUNÇÃO PARA DAR/RETIRAR LIKE
    async function toggleLike(logId, userId) {
        const url = "http://localhost:3000/likes";
        try {
            // Tenta dar o like primeiro
            let response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_log: logId, id_user: userId })
            });

            if (response.status === 201) { // Like adicionado
                console.log(`Like adicionado ao log ${logId}`);
                carregarLogs(); // Recarrega
                return;
            }

            // Se falhar com 409 (Conflito), tenta retirar o like
            if (response.status === 409) {
                response = await fetch(`${url}?id_log=${logId}&id_user=${userId}`, {
                    method: "DELETE"
                });

                if (response.ok) { // Deslike bem-sucedido
                    console.log(`Like removido do log ${logId}`);
                    carregarLogs(); // Recarrega
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

    // 3. ADICIONA EVENT LISTENER NOS BOTÕES DE LIKE
    function adicionarListenersLike() {
        if (!usuario || !usuario.id) {
             console.error("ID do usuário não definido para listeners de like.");
             return;
        }
        const userId = usuario.id;
        document.querySelectorAll('.btn-like').forEach(button => {
            // Limpa listeners antigos clonando o nó (necessário para recarregar o DOM)
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

    // 4. FUNÇÃO PRINCIPAL PARA CARREGAR O FEED DE LOGS
    async function carregarLogs() {
        // IDs dos elementos no HTML
        const logsFeed = document.getElementById('logs-feed-comunidade');
        const termoPesquisa = document.getElementById('inputSearch') ? document.getElementById('inputSearch').value : '';
        const categoriaFiltroSelect = document.getElementById('searchCategory');
        const categoriaFiltro = categoriaFiltroSelect ? categoriaFiltroSelect.value : '';
        const paginaAtualEl = document.getElementById('paginaAtual');
        const btnAnterior = document.getElementById('btnAnterior');
        const btnProximo = document.getElementById('btnProximo');


        logsFeed.innerHTML = '<div class="alert alert-info text-center">Carregando logs da comunidade...</div>';

        // Constrói a URL com paginação e filtros
        let url = `http://localhost:3000/logs?pagina=${paginaAtual}&quantidade=${logsPorPagina}&userId=${usuario.id}`;

        if (termoPesquisa) {
            url += `&search=${encodeURIComponent(termoPesquisa)}`; // 'search' é o filtro de texto
        }
        if (categoriaFiltro) {
            url += `&categoria=${encodeURIComponent(categoriaFiltro)}`;
        }

        try {
            const response = await fetch(url);

            if (!response.ok) {
                 throw new Error(`Falha na conexão com o servidor. Status: ${response.status}`);
            }

            const logs = await response.json();

            logsFeed.innerHTML = ''; // Limpa o carregamento

            if (logs.length === 0 && paginaAtual === 1) {
                logsFeed.innerHTML = '<div class="alert alert-warning text-center">Nenhum log encontrado com os filtros aplicados.</div>';
                btnProximo.disabled = true;
                return;
            } else if (logs.length === 0) {
                 // Se chegou no fim da lista e tentou avançar
                 paginaAtual--;
                 carregarLogs(); // Volta para a página anterior
                 return;
            }

            logs.forEach(log => {
                const horasLog = parseFloat(log.horas_trabalhadas) || 0;
                const avatarInitial = (log.usuario_nome ? log.usuario_nome.charAt(0) : '?').toUpperCase();

                // Verifica se a API retornou a informação se o usuário atual curtiu
                const isLiked = log.usuarioCurtiu === true;
                const likeClasses = isLiked ? 'text-danger' : 'text-muted';
                const heartIcon = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';

                const logElement = document.createElement('div');
                // Adiciona classes para o card (assumindo estilo Bootstrap + CSS customizado)
                logElement.className = 'log-card bg-white rounded-lg shadow p-5 mb-5 transition duration-150 ease-in-out hover:shadow-md';
                logElement.innerHTML = `
                    <div class="log-header d-flex align-items-center mb-3">
                        <div class="user-avatar">${avatarInitial}</div>
                        <div>
                            <h6 class="mb-0 fw-bold">${log.usuario_nome || 'Usuário Desconhecido'}</h6>
                            <span class="text-xs text-muted">${new Date(log.data_registro).toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>

                    <h5 class="mt-2 mb-2 text-lg font-bold">${log.titulo || 'Log Sem Título'}
                        <span class="badge bg-primary ms-2">${log.categoria || 'Sem Categoria'}</span>
                    </h5>

                    <p class="text-sm text-gray-600 mb-3">${log.descricao_do_trabalho || 'Nenhuma descrição fornecida.'}</p>

                    <div class="log-metrics-detail d-flex gap-4 text-xs text-gray-500 border-top pt-2">
                        <span>🕒 ${horasLog.toFixed(1)}h</span>
                        <span>✍️ ${log.linhas_codigo || 0} linhas</span>
                        <span>🐛 ${log.bugs_corrigidos || 0} bugs corrigidos</span>
                    </div>

                    <div class="log-actions mt-3 d-flex align-items-center space-x-4">
                        <button class="btn-like btn btn-sm btn-link p-0 ${likeClasses}" data-log-id="${log.id}">
                            ${heartIcon} <span class="ml-1 text-sm font-medium">${log.likes_count || 0}</span>
                        </button>
                        <button class="btn btn-sm btn-link text-muted p-0 ms-3">
                           <i class="far fa-comment"></i> <span class="ml-1 text-sm">Comentar</span>
                        </button>
                    </div>
                `;
                logsFeed.appendChild(logElement);
            });

            // Atualiza o estado da paginação
            if (paginaAtualEl) paginaAtualEl.textContent = `Página ${paginaAtual}`;
            if (btnAnterior) btnAnterior.disabled = (paginaAtual === 1);
            if (btnProximo) btnProximo.disabled = (logs.length < logsPorPagina); // Desabilita se a página não estiver completa

            adicionarListenersLike();

        } catch (error) {
            console.error("Erro ao carregar logs:", error);
            logsFeed.innerHTML = '<div class="alert alert-danger text-center">Falha ao carregar o feed. Verifique se o servidor está rodando e conectado ao banco.</div>';
        }
    }

    // 5. EVENT LISTENERS DE INICIALIZAÇÃO
    document.addEventListener('DOMContentLoaded', () => {
        // Carrega logs iniciais
        carregarLogs();

        // Eventos de Paginação
        const btnAnterior = document.getElementById('btnAnterior');
        const btnProximo = document.getElementById('btnProximo');
        const inputSearch = document.getElementById('inputSearch');

        if (btnAnterior) {
            btnAnterior.addEventListener('click', () => {
                if (paginaAtual > 1) {
                    paginaAtual--;
                    carregarLogs();
                }
            });
        }

        if (btnProximo) {
            btnProximo.addEventListener('click', () => {
                paginaAtual++;
                carregarLogs();
            });
        }

        // Evento de Pesquisa (com debounce)
        if (inputSearch) {
            let searchTimeout;
            inputSearch.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    paginaAtual = 1; // Reseta a página ao pesquisar
                    carregarLogs();
                }, 500); // Delay de 500ms
            });
        }

        // Evento de Filtro por Categoria (se existir o select)
        const searchCategory = document.getElementById('searchCategory');
        if (searchCategory) {
            searchCategory.addEventListener('change', () => {
                paginaAtual = 1; // Reseta a página ao filtrar
                carregarLogs();
            });
        }
    });

}
