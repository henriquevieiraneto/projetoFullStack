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

    // URL Base da API (Seu servidor app.js)
    const API_URL = 'http://localhost:3000';

    // Variáveis de estado para controle de paginação e pesquisa
    let paginaAtual = 1;
    const logsPorPagina = 10;
    let searchTimeout; // Para debounce (atraso) na pesquisa

    /**
     * Função para exibir mensagens customizadas (substitui alert)
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - 'success', 'danger', 'info', 'warning'.
     */
    function displayAlert(message, type = 'danger') {
        // Assume que existe um <div id="message-box"> no HTML
        const messageBox = document.getElementById('message-box'); 
        if (messageBox) {
            messageBox.textContent = message;
            // Define a classe de cor (Bootstrap)
            messageBox.className = `alert alert-${type} text-center`;
            messageBox.classList.remove('hidden'); // 'hidden' é uma classe que deve ser definida no CSS
            setTimeout(() => {
                 messageBox.classList.add('hidden');
                 messageBox.textContent = '';
            }, 5000);
        } else {
            console.error(`ALERTA (${type}):`, message); // Fallback se o elemento não existir
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
        // Inclui userId para que o backend possa retornar se o usuário atual curtiu (campo 'usuarioCurtiu')
        let url = `${API_URL}/logs?pagina=${paginaAtual}&quantidade=${logsPorPagina}&userId=${usuario.id}`;

        if (termoPesquisa) {
            url += `&search=${encodeURIComponent(termoPesquisa)}`; // 'search' é o filtro de texto
        }
        if (categoriaFiltro) {
            url += `&categoria=${encodeURIComponent(categoriaFiltro)}`;
        }

        try {
            const response = await fetch(url);

            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Falha na conexão com o servidor. Status: ${response.status}. Detalhe: ${errorText}`);
            }

            const logs = await response.json();

            logsFeed.innerHTML = ''; // Limpa o carregamento

            if (logs.length === 0 && paginaAtual === 1) {
                logsFeed.innerHTML = '<div class="alert alert-warning text-center">Nenhum log encontrado com os filtros aplicados.</div>';
                if (btnProximo) btnProximo.disabled = true;
                return;
            } else if (logs.length === 0) {
                 // Se chegou no fim da lista e tentou avançar
                 paginaAtual--;
                 if (paginaAtualEl) paginaAtualEl.textContent = `Página ${paginaAtual}`;
                 displayAlert("Você já está na última página.", "info");
                 if (btnProximo) btnProximo.disabled = true;
                 return;
            }

            logs.forEach(log => {
                const horasLog = parseFloat(log.horas_trabalhadas) || 0;
                const avatarInitial = (log.usuario_nome ? log.usuario_nome.charAt(0) : '?').toUpperCase();

                // Verifica se a API retornou a informação se o usuário atual curtiu
                const isLiked = log.usuarioCurtiu === true;
                const likeClass = isLiked ? 'text-danger' : 'text-muted';
                // Assumindo que o HTML usa Font Awesome (precisa do link no <head>)
                const heartIcon = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>'; 

                const logElement = document.createElement('div');
                // Adiciona classes para o card (assumindo estilo Bootstrap + CSS customizado)
                logElement.className = 'log-card bg-white rounded-lg shadow-sm p-4 mb-3';
                logElement.innerHTML = `
                    <div class="log-header d-flex align-items-center mb-3">
                        <div class="user-avatar">${avatarInitial}</div>
                        <div>
                            <h6 class="mb-0 fw-bold">${log.usuario_nome || 'Usuário Desconhecido'}</h6>
                            <span class="small text-muted">${new Date(log.data_registro).toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>

                    <h5 class="mt-2 mb-2 fw-bold">${log.titulo || 'Log Sem Título'}
                        <span class="badge bg-primary ms-2">${log.categoria || 'Sem Categoria'}</span>
                    </h5>

                    <p class="small">${log.descricao_do_trabalho || 'Nenhuma descrição fornecida.'}</p>

                    <div class="log-metrics-detail d-flex gap-3 small text-muted border-top pt-2 mt-2">
                        <span>🕒 ${horasLog.toFixed(1)}h</span>
                        <span>✍️ ${log.linhas_codigo || 0} linhas</span>
                        <span>🐛 ${log.bugs_corrigidos || 0} bugs corrigidos</span>
                    </div>

                    <div class="log-actions mt-3 d-flex align-items-center">
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
            btnAnterior.addEventListener('click', (e) => {
                e.preventDefault();
                if (paginaAtual > 1) {
                    paginaAtual--;
                    carregarLogs();
                }
            });
        }

        if (btnProximo) {
            btnProximo.addEventListener('click', (e) => {
                e.preventDefault();
                paginaAtual++;
                carregarLogs();
            });
        }

        // Evento de Pesquisa (com debounce)
        if (inputSearch) {
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

} // Fim do bloco 'if (usuario)'

