// --- INÍCIO DA VERIFICAÇÃO DE AUTENTICAÇÃO ---
const usuarioLogado = localStorage.getItem('usuarioLogado');
let usuario; // Variável global para armazenar os dados do usuário logado

if (!usuarioLogado) {
    // Se não houver dados no localStorage, redireciona para a tela de login
    console.warn("Cad_logs.js: Usuário não autenticado. Redirecionando para o login.");
    // Caminho relativo correto para sair de /cad_logs/ e entrar em /login/
    window.location.href = '../login/login.html';
} else {
    // Somente continua a execução se o usuário estiver logado
    try {
        usuario = JSON.parse(usuarioLogado);
        // Verifica se os dados essenciais (id e nome) existem
        if (!usuario || !usuario.id || !usuario.nome) {
            throw new Error("Dados de usuário inválidos ou incompletos no localStorage.");
        }
        console.log("Cad_logs.js: Usuário autenticado:", usuario.nome, "(ID:", usuario.id, ")");
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

    // URL Base da API (Onde seu servidor app.js está rodando)
    const API_URL = 'http://localhost:3000';
    let editingLogId = null; // Controla se estamos editando ou criando

    /**
     * Função para exibir mensagens na UI (substitui alert).
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - 'success', 'danger', 'info', 'warning'.
     */
    function displayMessage(message, type = 'danger') {
        const messageBox = document.getElementById('message-box'); // ID da div de mensagem no HTML
        if (messageBox) {
            messageBox.textContent = message;
            // Define a classe de cor (Bootstrap)
            messageBox.className = `p-3 rounded-lg text-center text-sm ${
                type === 'success' ? 'alert alert-success' :
                type === 'info' ? 'alert alert-info' :
                'alert alert-danger' 
            }`;
            messageBox.classList.remove('hidden'); // 'hidden' é uma classe que deve ser definida no CSS
            // Remove a mensagem após 5 segundos
            setTimeout(() => {
                if (messageBox) {
                     messageBox.classList.add('hidden');
                     messageBox.textContent = '';
                }
            }, 5000);
        } else {
            console.error(`ALERTA (${type}): ${message}`); // Fallback para console
        }
    }

    /**
     * Função principal para lidar com o envio do formulário de log (CRIAR ou ATUALIZAR).
     * @param {Event} event - O evento de submit.
     */
    async function handleLogSubmit(event) {
        event.preventDefault(); // Impede o refresh da página

        const btnSubmit = event.target.querySelector('button[type="submit"]');

        // Coleta todos os dados do formulário (IDs dos inputs no cad_logs.html)
        const dadosLog = {
            titulo: document.getElementById('titulo').value,
            categoria: document.getElementById('categoria').value,
            horas_trabalhadas: document.getElementById('horas_trabalhadas').value,
            // Campos opcionais, envia 0 se vazios
            linhas_codigo: document.getElementById('linhas_codigo').value || 0,
            bugs_corrigidos: document.getElementById('bugs_corrigidos').value || 0,
            // Mapeia o campo 'descricao' do HTML para 'descricao_do_trabalho' do Backend
            descricao_do_trabalho: document.getElementById('descricao').value,
            // Adiciona ID do usuário logado
            id_usuario: usuario.id,
            // Adiciona a data (O app.js foi corrigido para aceitar 'data_log' ou 'data_registro')
            data_log: document.getElementById('data_log').value || new Date().toISOString().split('T')[0] // Formato YYYY-MM-DD
        };

        console.log("Dados do Log a serem enviados:", dadosLog);

        // Validação simples
        if (!dadosLog.titulo || !dadosLog.categoria || !dadosLog.horas_trabalhadas || !dadosLog.descricao_do_trabalho) {
             displayMessage("Preencha todos os campos obrigatórios (Título, Categoria, Horas, Descrição).", "warning");
             return;
        }

        // Feedback visual e trava botão
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = 'Salvando...'; // Remove o ícone se não estiver usando Font Awesome
        displayMessage("Enviando log para o servidor...", "info");

        // Define a URL e o Método (POST para criar, PUT para editar)
        let url = `${API_URL}/logs`;
        let method = 'POST';

        if (editingLogId) {
            url = `${API_URL}/logs/${editingLogId}`;
            method = 'PUT';
        }

        try {
            // Envio para o Backend (rota POST ou PUT)
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosLog)
            });

            let responseData;
            try {
                responseData = await response.json();
            } catch (e) {
                responseData = { message: await response.text() }; // Se não for JSON
            }

            if (response.ok) { // Status 200 (Atualizado) ou 201 (Criado)
                const successMessage = editingLogId 
                    ? "Log atualizado com sucesso! Redirecionando..."
                    : "Log registrado com sucesso! Redirecionando...";
                displayMessage(successMessage, "success");

                // REDIRECIONAMENTO PARA O DASHBOARD APÓS SUCESSO
                setTimeout(() => {
                    // Caminho absoluto para a pasta index
                    window.location.href = '../index/index.html';
                }, 1000); // Atraso de 1 segundo para o usuário ler a mensagem

            } else {
                // Erro do servidor (4xx, 5xx)
                // O app.js envia 'errorDetail' com a mensagem do MySQL
                const errorMessage = responseData.errorDetail || responseData.message || `Erro desconhecido (Status ${response.status}).`;
                displayMessage(`Falha no registro: ${errorMessage}`, "danger");
                console.error("Erro detalhado do servidor:", responseData);
            }

        } catch (error) {
            // Erro de rede (fetch falhou, servidor offline)
            console.error("Erro de conexão ao registrar log:", error);
            displayMessage(`Falha na conexão com o servidor. Verifique se o Node.js está rodando.`, "danger");
        } finally {
            // Reabilita o botão
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = editingLogId ? 'Salvar Alterações' : 'Registrar Log';
        }
    }
    
    /**
     * Verifica se a página está em "Modo de Edição" ao carregar.
     */
    async function checkForEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const logId = urlParams.get('editId'); // Pega o ID da URL

        if (!logId) {
            console.log("Modo: Novo Log.");
            return; // Não está em modo de edição
        }
        
        console.log("Modo: Edição de Log. ID:", logId);
        editingLogId = logId; // Define o ID global de edição

        // Busca os dados completos do log no backend
        displayMessage("Carregando dados do log para edição...", "info");
        try {
            const response = await fetch(`${API_URL}/logs/${logId}`); // Usa a nova rota GET /logs/:id
            if (!response.ok) {
                 const errData = await response.json().catch(() => ({}));
                 throw new Error(errData.message || `Erro HTTP ${response.status}`);
            }
            
            const logData = await response.json();
            
            // Verifica se o usuário logado é o dono do log (SEGURANÇA)
            if (logData.id_usuario !== usuario.id) {
                displayMessage("Erro: Você não tem permissão para editar este log.", "danger");
                setTimeout(() => window.location.href = '../index/index.html', 2000);
                return;
            }

            // Preenche o formulário com os dados do log
            document.getElementById('titulo').value = logData.titulo || '';
            document.getElementById('categoria').value = logData.categoria || '';
            document.getElementById('horas_trabalhadas').value = logData.horas_trabalhadas || 0;
            document.getElementById('linhas_codigo').value = logData.linhas_codigo || 0;
            document.getElementById('bugs_corrigidos').value = logData.bugs_corrigidos || 0;
            document.getElementById('descricao').value = logData.descricao_do_trabalho || '';
            
            // Formata a data (MySQL 'data_registro' é YYYY-MM-DDTHH:MM:SS.sssZ, o input <date> quer YYYY-MM-DD)
            if (logData.data_registro) {
                document.getElementById('data_log').value = new Date(logData.data_registro).toISOString().split('T')[0];
            }

            // Atualiza a UI para o modo de edição
            document.querySelector('.form-title').textContent = "Editar Log";
            document.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i> Salvar Alterações';
            
            displayMessage("Dados do log carregados. Pronto para editar.", "success");

        } catch (error) {
            console.error("Erro ao carregar dados para edição:", error);
            displayMessage(`Não foi possível carregar os dados do log: ${error.message}`, "danger");
            editingLogId = null; // Reseta o modo de edição se falhar
        }
    }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    document.addEventListener('DOMContentLoaded', () => {
         const formLog = document.getElementById('log-form'); // ID do formulário no HTML
         const userInfoElement = document.getElementById('user-info'); // Onde mostrar info do user

         if(userInfoElement && usuario.nome){
             userInfoElement.textContent = `Registrando log para: ${usuario.nome}`;
         }

        if (formLog) {
            formLog.addEventListener('submit', handleLogSubmit);
        } else {
             console.error("Formulário 'log-form' não encontrado no DOM.");
        }
        
        // Verifica se estamos em modo de edição (lendo o ?editId= da URL)
        checkForEditMode(); 
    }); 

} // Fim do bloco 'if (usuario)'

