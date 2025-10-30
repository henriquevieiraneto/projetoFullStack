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

    // Referências do DOM
    const formLog = document.getElementById('log-form');
    const messageBox = document.getElementById('message-box');
    const userInfoElement = document.getElementById('user-info');
    const formTitle = document.getElementById('form-title');
    const submitButton = document.getElementById('submit-button');

    /**
     * Exibe mensagens na UI (substitui alert).
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - 'success', 'danger', 'info', 'warning'.
     */
    function displayMessage(message, type = 'danger') {
        if (messageBox) {
            messageBox.textContent = message;
            // Define a classe de cor (Bootstrap)
            messageBox.className = `p-3 rounded-lg text-center text-sm ${
                type === 'success' ? 'alert alert-success' :
                type === 'info' ? 'alert alert-info' :
                type === 'warning' ? 'alert alert-warning' :
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
            console.error(`ALERTA (${type}): ${message}`); // Fallback
        }
    }

    /**
     * Função principal para lidar com o envio do formulário de log (CRIAR ou ATUALIZAR).
     * @param {Event} event - O evento de submit.
     */
    async function handleLogSubmit(event) {
        event.preventDefault(); // Impede o refresh da página

        // Coleta todos os dados do formulário
        // CORREÇÃO: Não enviamos 'data_log'
        const dadosLog = {
            titulo: document.getElementById('titulo').value,
            categoria: document.getElementById('categoria').value,
            horas_trabalhadas: document.getElementById('horas_trabalhadas').value,
            linhas_codigo: document.getElementById('linhas_codigo').value || 0,
            bugs_corrigidos: document.getElementById('bugs_corrigidos').value || 0,
            descricao_do_trabalho: document.getElementById('descricao').value,
            id_usuario: usuario.id
            // O campo data_log foi REMOVIDO para corrigir o erro 'Unknown column'
        };

        console.log("Dados do Log a serem enviados:", dadosLog);

        // Validação
        if (!dadosLog.titulo || !dadosLog.categoria || !dadosLog.horas_trabalhadas || !dadosLog.descricao_do_trabalho) {
             displayMessage("Preencha todos os campos obrigatórios (Título, Categoria, Horas, Descrição).", "warning");
             return;
        }

        // Feedback visual e trava botão
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';
        displayMessage("Enviando log para o servidor...", "info");

        let url = `${API_URL}/logs`;
        let method = 'POST';

        if (editingLogId) {
            url = `${API_URL}/logs/${editingLogId}`;
            method = 'PUT';
            // Se estiver editando, precisamos enviar a data original de volta
            // ou o app.js (PUT) irá falhar se esperar 'data_log'
            // Vamos adicionar a data de volta APENAS se estiver editando
            const dataOriginal = document.getElementById('data_log_hidden')?.value; // Pega de um campo oculto se necessário
            dadosLog.data_log = dataOriginal || new Date().toISOString().split('T')[0];
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
                    window.location.href = '../index/index.html';
                }, 1000); 

            } else {
                // Erro do servidor (4xx, 5xx)
                const errorMessage = responseData.errorDetail || responseData.message || `Erro desconhecido (Status ${response.status}).`;
                displayMessage(`Falha no registro: ${errorMessage}`, "danger");
            }

        } catch (error) {
            // Erro de rede (fetch falhou, servidor offline)
            console.error("Erro de conexão ao registrar log:", error);
            displayMessage(`Falha na conexão com o servidor. Verifique se o Node.js está rodando.`, "danger");
        } finally {
            // Reabilita o botão
            submitButton.disabled = false;
            submitButton.innerHTML = editingLogId 
                ? '<i class="fas fa-save me-2"></i> Salvar Alterações' 
                : '<i class="fas fa-check me-2"></i> Registrar Log';
        }
    }
    
    /**
     * Verifica se a página está em "Modo de Edição" ao carregar.
     */
    async function checkForEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const logId = urlParams.get('editId'); 

        if (!logId) {
            console.log("Modo: Novo Log.");
            return; 
        }
        
        console.log("Modo: Edição de Log. ID:", logId);
        editingLogId = logId; 

        displayMessage("Carregando dados do log para edição...", "info");
        try {
            const response = await fetch(`${API_URL}/logs/${logId}`); 
            if (!response.ok) {
                 const errData = await response.json().catch(() => ({}));
                 throw new Error(errData.message || `Erro HTTP ${response.status}`);
            }
            
            const logData = await response.json();
            
            // Segurança: Verifica se o usuário logado é o dono do log
            if (Number(logData.id_usuario) !== Number(usuario.id)) {
                displayMessage("Erro: Você não tem permissão para editar este log.", "danger");
                setTimeout(() => window.location.href = '../index/index.html', 2000);
                return;
            }

            // Preenche o formulário
            document.getElementById('titulo').value = logData.titulo || '';
            document.getElementById('categoria').value = logData.categoria || '';
            document.getElementById('horas_trabalhadas').value = logData.horas_trabalhadas || 0;
            document.getElementById('linhas_codigo').value = logData.linhas_codigo || 0;
            document.getElementById('bugs_corrigidos').value = logData.bugs_corrigidos || 0;
            document.getElementById('descricao').value = logData.descricao_do_trabalho || '';
            
            // Armazena a data original (mesmo que o campo não exista mais no HTML visível)
            // para que possamos enviá-la de volta no PUT
            const dataOriginal = logData.data_registro || logData.data_log;
            if(dataOriginal) {
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.id = 'data_log_hidden';
                hiddenInput.value = new Date(dataOriginal).toISOString().split('T')[0];
                formLog.appendChild(hiddenInput);
            }

            // Atualiza a UI para o modo de edição
            if(formTitle) formTitle.textContent = "Editar Log";
            if(submitButton) submitButton.innerHTML = '<i class="fas fa-save me-2"></i> Salvar Alterações';
            
            displayMessage("Dados do log carregados. Pronto para editar.", "success");

        } catch (error) {
            console.error("Erro ao carregar dados para edição:", error);
            displayMessage(`Não foi possível carregar os dados do log: ${error.message}`, "danger");
            editingLogId = null; 
        }
    }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    document.addEventListener('DOMContentLoaded', () => {
         // Define o nome do usuário na UI
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

