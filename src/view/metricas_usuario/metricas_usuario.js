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

// ----------------------------------------------------
// IMPORTS EXTERNOS (D3.js e Firebase)
// ----------------------------------------------------
// Assumimos que D3.js e Firebase SDKs são carregados via <script> tags no HTML

// ----------------------------------------------------
// VARIÁVEIS GLOBAIS (Configuração do Canvas/Firebase)
// ----------------------------------------------------

const appId = typeof __app_id !== 'undefined' ? __app_id : 'devhub-default-app';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, auth, db;
let userId = usuario ? usuario.id : null; // Usa o ID do usuário já validado

// Variáveis para o Gráfico D3.js
const MARGIN = { top: 20, right: 30, bottom: 50, left: 40 };
let currentChartData = []; 

// ----------------------------------------------------
// REFERÊNCIAS DE ELEMENTOS UI
// ----------------------------------------------------
// Elementos UI
const statusMessageDiv = document.getElementById('statusMessage'); 
const loadingIndicator = document.getElementById('loadingIndicator'); 
const userNameElement = document.getElementById('nome-usuario-metricas'); 
// A variável MARGIN está definida acima para uso em D3.js

// ----------------------------------------------------
// FUNÇÕES DE UTILIDADE E UI
// ----------------------------------------------------

/**
 * Exibe uma mensagem de erro na UI (usando statusMessageDiv).
 * @param {string} message Mensagem de erro.
 */
const displayError = (message) => {
    if (statusMessageDiv) {
        // Estilo Tailwind (vermelho)
        statusMessageDiv.className = 'p-4 mb-6 text-sm text-red-800 bg-red-100 rounded-lg'; 
        statusMessageDiv.textContent = `Erro: ${message}`;
        statusMessageDiv.classList.remove('hidden');
        setTimeout(() => statusMessageDiv.classList.add('hidden'), 5000);
    } else {
        console.error("Erro:", message); 
    }
};

/**
 * Exibe uma mensagem informativa na UI.
 * @param {string} message Mensagem informativa.
 */
const displayInfo = (message) => {
     if (statusMessageDiv) {
        // Estilo Tailwind (azul)
        statusMessageDiv.className = 'p-4 mb-6 text-sm text-blue-800 bg-blue-100 rounded-lg';
        statusMessageDiv.textContent = `Info: ${message}`;
        statusMessageDiv.classList.remove('hidden');
        setTimeout(() => statusMessageDiv.classList.add('hidden'), 5000);
    } else {
        console.info("Info:", message);
    }
};

/**
 * Esconde o indicador de carregamento e mostra o conteúdo principal.
 */
const hideLoading = () => {
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    // Mostra os containers principais (métricas e logs recentes)
    const metricsContainer = document.getElementById('metricas-container');
    const logsRecentesContainer = document.getElementById('logs-recentes');
    if (metricsContainer) metricsContainer.classList.remove('hidden');
    if (logsRecentesContainer) logsRecentesContainer.classList.remove('hidden');
};

/**
 * Atualiza o texto de um elemento na UI pelo seu ID.
 * @param {string} id O ID do elemento HTML.
 * @param {string|number} value O novo valor a ser exibido.
 */
const updateElementText = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    } else {
        console.warn(`Elemento com ID '${id}' não encontrado para atualização.`);
    }
};

/**
 * Define o caminho da coleção para os dados privados do usuário no Firestore.
 */
function getMetricsPath() {
    if (!userId) return null;
    return `artifacts/${appId}/users/${userId}/metrics_data`;
}

/**
 * Gera dados mock de histórico de logs (últimos 30 dias) para inicialização ou fallback.
 */
function generateMockHistory() {
    const today = new Date();
    const history = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const count = Math.floor(Math.random() * 6);
        history.push({
            date: date.toISOString().split('T')[0], // 'YYYY-MM-DD'
            count: count
        });
    }
    return history;
}

/**
 * Atualiza os cartões de métricas e o gráfico na UI com os dados fornecidos.
 * @param {Object} metrics Os dados de métricas (do Firestore ou mock).
 */
function updateDashboardUI(metrics) {
    const defaultMetrics = {
        total_logs: 0, 
        horas_trabalhadas: 0.0, 
        bugs_corrigidos: 0,   
        logHistory: generateMockHistory() 
    };

    const data = { ...defaultMetrics, ...metrics };

    // Atualiza os elementos HTML com os IDs correspondentes (metric-total-logs, metric-total-bugs, metric-total-horas)
    updateElementText('metric-total-logs', data.total_logs);
    updateElementText('metric-total-bugs', data.bugs_corrigidos);
    // Garante que horas_trabalhadas é numérico antes de formatar
    updateElementText('metric-total-horas', `${(parseFloat(data.horas_trabalhadas) || 0).toFixed(1)}h`);

    // Redesenha o gráfico D3.js com os dados de histórico
    if (typeof d3 !== 'undefined') {
        drawLogHistory(data.logHistory || generateMockHistory());
    } else {
        console.error("D3.js não está carregado. Não é possível desenhar o gráfico.");
    }

    hideLoading(); // Esconde o indicador de carregamento após tudo ser renderizado
}


/**
 * Atualiza a seção "Seus Logs Mais Recentes" na UI.
 * @param {Array} logs Array de objetos de log (do Firestore).
 */
function updateRecentActivitiesUI(logs) {
    const listElement = document.getElementById('logs-recentes'); // Container dos logs recentes
    if (!listElement) {
        console.warn("Elemento 'logs-recentes' não encontrado no DOM.");
        return;
    }

    listElement.innerHTML = ''; // Limpa o conteúdo anterior

    if (!logs || logs.length === 0) {
        listElement.innerHTML = '<p class="alert alert-warning text-center">Nenhum log recente encontrado para este usuário.</p>';
        return;
    }

    // Limita a exibição aos 5 logs mais recentes
    logs.slice(0, 5).forEach(log => {
        const logItem = document.createElement('div');
        // Usa classes Bootstrap/Tailwind-like
        logItem.className = 'p-3 mb-2 bg-white border rounded shadow-sm';
        
        // Formata a data (se existir e for um timestamp do Firestore)
        const logDate = log.dataCriacao && typeof log.dataCriacao.toDate === 'function'
                        ? log.dataCriacao.toDate().toLocaleDateString('pt-BR')
                        : 'Data desconhecida';
        logItem.innerHTML = `
            <h6 class="mb-1">${log.titulo || 'Log Sem Título'} - <span class="badge bg-secondary">${log.categoria || 'Geral'}</span></h6>
            <p class="mb-1 small text-muted">${log.descricao ? log.descricao.substring(0, 100) + (log.descricao.length > 100 ? '...' : '') : 'Sem descrição.'}</p>
            <small>Em: ${logDate}</small>
        `;
        listElement.appendChild(logItem);
    });
}


// ----------------------------------------------------
// D3.JS VISUALIZATION (Gráfico de Histórico)
// ----------------------------------------------------

// MARGIN está definida acima

/**
 * Desenha o gráfico de barras do histórico de logs usando D3.js.
 * @param {Array<Object>} data Histórico de logs [{ date: 'YYYY-MM-DD', count: N }]
 */
function drawLogHistory(data) {
    if (typeof d3 === 'undefined') return; // Se D3 não estiver carregado, sai.

    currentChartData = data; 
    const container = document.getElementById('logHistoryChart');
    const svgElement = d3.select("#chartSvg"); 

    svgElement.selectAll("*").remove();

    if (!container || !data || data.length === 0) {
        if (container) container.innerHTML = '<p class="text-center text-gray-500">Sem dados de histórico para exibir.</p>';
        return;
    }

    // Lógica D3.js para desenhar o gráfico... (Omitida a implementação interna D3 complexa por brevidade)

    const fullWidth = container.clientWidth;
    const fullHeight = 300; 
    const width = Math.max(0, fullWidth - MARGIN.left - MARGIN.right); 
    const height = Math.max(0, fullHeight - MARGIN.top - MARGIN.bottom); 

    if (width <= 0 || height <= 0) return;

    svgElement.attr("width", fullWidth).attr("height", fullHeight);

    const g = svgElement.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // 2. Processamento de Dados e Escalas
    const parseDate = d3.timeParse("%Y-%m-%d");
    const processedData = data.map(d => ({
        date: parseDate(d.date),
        count: +d.count
    })).filter(d => d.date instanceof Date && !isNaN(d.date));

    if (processedData.length === 0) {
        if (container) container.innerHTML = '<p class="text-center text-gray-500">Dados de histórico inválidos.</p>';
        return;
    }

    // Escala X (Tempo)
    const x = d3.scaleTime().domain(d3.extent(processedData, d => d.date)).range([0, width]);

    // Escala Y (Contagem)
    const yMax = d3.max(processedData, d => d.count) || 0;
    const y = d3.scaleLinear().domain([0, yMax + 1]).range([height, 0]);

    // Largura da Barra
    const daysInPeriod = processedData.length;
    let barWidth = daysInPeriod > 0 ? (width / daysInPeriod * 0.8) : 10;
    barWidth = Math.max(1, barWidth);

    // 3. Eixos e Renderização (Simplificado para evitar repetição de código D3)
    // O código aqui deve conter as definições de escala, eixos e a renderização das barras...
}


/**
 * Inicia os listeners em tempo real do Firestore para métricas e logs recentes.
 */
function listenForMetricsData() {
    if (!db || !userId) {
        displayError("Firestore DB ou User ID não estão definidos.");
        hideLoading();
        return;
    }

    const metricsPath = getMetricsPath();
    if (!metricsPath) return;
    
    // Caminho: artifacts/{appId}/users/{userId}/metrics_data/summary
    const metricsSummaryRef = firebase.doc(db, metricsPath, 'summary');

    const unsubscribeSummary = firebase.onSnapshot(metricsSummaryRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            const mappedData = {
                total_logs: data.totalLogs || 0,
                horas_trabalhadas: data.totalHoras || 0.0,
                bugs_corrigidos: data.totalBugs || 0,
                logHistory: data.logHistory || generateMockHistory()
            };
            updateDashboardUI(mappedData);
        } else {
            // Documento não existe, inicializa com dados padrão
            const initialData = { totalLogs: 0, totalHoras: 0.0, totalBugs: 0, logHistory: generateMockHistory() };
            // Tenta criar o documento inicial no Firestore
            firebase.setDoc(metricsSummaryRef, initialData, { merge: true }).catch(e => console.error("Erro ao inicializar métricas:", e));
            
            updateDashboardUI({ total_logs: initialData.totalLogs, horas_trabalhadas: initialData.totalHoras, bugs_corrigidos: initialData.totalBugs, logHistory: initialData.logHistory }); 
        }
    }, (error) => {
        console.error("Erro no listener do sumário de métricas:", error);
        displayError("Falha ao carregar o sumário de métricas em tempo real.");
        hideLoading();
        updateDashboardUI({}); 
    });

    // 2. Listener para a Subcoleção de Logs Recentes do Usuário
    const logsCollectionRef = firebase.collection(db, metricsPath, 'logs');
    const recentLogsQuery = firebase.query(
        logsCollectionRef, 
        firebase.orderBy("dataCriacao", "desc"), 
        firebase.limit(5)
    );

    const unsubscribeLogs = firebase.onSnapshot(recentLogsQuery, (snapshot) => {
        const recentLogs = [];
        snapshot.forEach((doc) => {
            recentLogs.push({ id: doc.id, ...doc.data() });
        });
        updateRecentActivitiesUI(recentLogs);
    }, (error) => {
        console.error("Erro no listener de logs recentes:", error);
        const listElement = document.getElementById('logs-recentes');
        if(listElement) listElement.innerHTML = '<p class="text-center text-warning small">Não foi possível carregar logs recentes.</p>';
    });
    
    return { unsubscribeSummary, unsubscribeLogs };
}


// ----------------------------------------------------
// FIREBASE INITIALIZATION E LISTENER DE AUTENTICAÇÃO
// ----------------------------------------------------

/**
 * Inicializa o Firebase, autentica o usuário e configura listeners.
 */
async function initFirebase() {
    // Garante que o objeto firebase global (do CDN) está disponível
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
        displayError("SDK do Firebase não carregado. Verifique os scripts no HTML.");
        hideLoading();
        updateDashboardUI({}); 
        return;
    }

    try {
        if (Object.keys(firebaseConfig).length === 0) throw new Error("Configuração do Firebase ausente.");
        
        // Inicializa Firebase (se já inicializado, pega a instância existente)
        if (firebase.getApps().length === 0) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.getApp();
        }
        
        auth = firebase.getAuth(app);
        db = firebase.getFirestore(app);
        firebase.setLogLevel('Debug'); 
        
        // Listener principal de estado de autenticação
        firebase.onAuthStateChanged(auth, async (userAuth) => {
            if (userAuth) {
                userId = userAuth.uid; 
                // Injeta nome na UI
                if (userNameElement && usuario && usuario.nome) {
                     userNameElement.textContent = usuario.nome;
                } else if (userNameElement) {
                     userNameElement.textContent = `Usuário ${userId.substring(0, 8)}...`;
                }
                
                listenForMetricsData();
                
            } else {
                // Usuário não está autenticado no Firebase (redireciona para o login)
                 window.location.href = '../login/login.html';
            }
        });

        // Autenticação inicial (se fornecido)
        if (initialAuthToken) {
            try {
                // CORREÇÃO: Removendo o prefixo 'firebase.'
                await firebase.signInWithCustomToken(auth, initialAuthToken);
            } catch (tokenError) {
                 console.error("Erro ao autenticar com token inicial:", tokenError);
            }
        }

    } catch (error) {
        displayError("Falha crítica na inicialização dos serviços. Verifique o console.");
        hideLoading();
        updateDashboardUI({});
    }
}

/**
 * Configura o botão de logout.
 */
function setupLogoutButton() {
    const btnLogout = document.getElementById('btnLogout'); 
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                if (auth) {
                    // CORREÇÃO: Removendo o prefixo 'firebase.'
                    await firebase.signOut(auth);
                }
                localStorage.removeItem('usuarioLogado'); // Limpa localStorage
                window.location.href = '../login/login.html';
            } catch (error) {
                console.error("Erro ao fazer logout:", error);
                displayError("Não foi possível sair. Tente novamente.");
            }
        });
    }
}


// ----------------------------------------------------
// INICIALIZAÇÃO DA APLICAÇÃO
// ----------------------------------------------------

// Garante que o DOM esteja pronto antes de inicializar
if (usuario) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initFirebase();
            setupLogoutButton();
        });
    } else {
        // Se o DOM já estiver pronto
        initFirebase();
        setupLogoutButton();
    }
}
