// --- INÍCIO DA INICIALIZAÇÃO E CONFIGURAÇÃO ---

// URL Base da API (Onde seu servidor app.js está rodando)
const API_URL = 'http://localhost:3000';

// --- FUNÇÕES DE UTILIDADE ---

/**
 * Exibe mensagens de status ou erro no formulário.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - 'success', 'danger', 'info', ou 'warning'.
 */
function displayMessage(message, type = 'danger') {
    const mensagemStatus = document.getElementById('mensagemStatus');
    if (!mensagemStatus) {
        console.error("Elemento 'mensagemStatus' não encontrado no DOM.");
        return;
    }
    mensagemStatus.textContent = message;
    
    // Define a classe de cor (Bootstrap)
    mensagemStatus.className = 'text-center small fw-bold mt-2'; // Reset
    if (type === 'success') {
        mensagemStatus.classList.add('text-success');
    } else if (type === 'info') {
        mensagemStatus.classList.add('text-info');
    } else if (type === 'warning') {
        mensagemStatus.classList.add('text-warning');
    } else {
        mensagemStatus.classList.add('text-danger'); // Padrão
    }

    // Esconde a mensagem após 5 segundos
    setTimeout(() => {
        if (mensagemStatus) {
            mensagemStatus.textContent = '';
        }
    }, 5000);
}

/**
 * Salva os dados do usuário no localStorage.
 * @param {string} userId - ID do usuário.
 * @param {string} userName - Nome do usuário.
 */
function saveToLocalStorage(userId, userName) {
    const userData = { id: userId, nome: userName };
    // Usamos 'usuarioLogado' como a chave padrão em toda a aplicação
    localStorage.setItem('usuarioLogado', JSON.stringify(userData));
    console.log("Dados salvos no localStorage:", userData);
}

// --- LÓGICA DE AUTENTICAÇÃO (API Express/MySQL) ---

/**
 * Função principal para lidar com o envio do formulário (Login ou Cadastro).
 * @param {Event} event - O evento de submit.
 * @param {boolean} isRegistering - True se for o formulário de cadastro.
 */
async function handleAuth(event, isRegistering) {
    event.preventDefault(); // Impede o refresh da página (Corrige o loop)

    // Define os elementos e a URL da API com base no modo (Login vs Cadastro)
    const formId = isRegistering ? 'register-form' : 'login-form';
    const apiUrl = isRegistering ? `${API_URL}/cadastro` : `${API_URL}/login`;
    
    const emailInput = document.getElementById(isRegistering ? 'email-register' : 'email-login');
    const passwordInput = document.getElementById(isRegistering ? 'senha-register' : 'senha-login');
    const nomeInput = document.getElementById('nome-register'); // Só existe no registro

    const email = emailInput ? emailInput.value.trim() : null;
    const password = passwordInput ? passwordInput.value : null;
    
    const body = { email, senha: password }; // Envia 'senha' como o app.js espera

    if (isRegistering) {
        body.nome = nomeInput ? nomeInput.value.trim() : null;
    }

    // Validação
    if (!body.email || !body.senha || (isRegistering && !body.nome)) {
        displayMessage("Por favor, preencha todos os campos obrigatórios.", "warning");
        return;
    }

    displayMessage("Processando...", "info");
    const submitButton = document.querySelector(`#${formId} button[type="submit"]`);
    if(submitButton) submitButton.disabled = true;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json(); // Tenta ler o JSON da resposta

        if (response.ok) { // Status 200 (Login) ou 201 (Cadastro)
            
            // O backend (app.js) retorna { id, nome } em ambos os casos
            const userName = data.nome || email.split('@')[0];
            const userId = data.id;

            if (!userId) {
                throw new Error("API não retornou um ID de usuário.");
            }

            saveToLocalStorage(userId, userName);
            const successMessage = isRegistering ? "Cadastro realizado!" : `Bem-vindo(a), ${userName}!`;
            displayMessage(`${successMessage} Redirecionando...`, "success");

            // Redireciona para o Dashboard
            setTimeout(() => {
                // Caminho relativo para a pasta 'index'
                window.location.href = '../index/index.html'; 
            }, 1000); 

        } else {
            // Erro do servidor (ex: 401, 409, 500)
            throw new Error(data.message || "Ocorreu um erro no servidor.");
        }

    } catch (error) {
        console.error("Erro de autenticação:", error);
        displayMessage(`Falha: ${error.message}`, "danger");
        if(submitButton) submitButton.disabled = false; // Reabilita o botão
    }
}

// --- GERENCIAMENTO DE ESTADO DA UI E LISTENERS ---

/**
 * Verifica se o usuário já está logado (no localStorage) ao carregar a página.
 * Se sim, redireciona direto para o index.
 */
function checkIfLoggedIn() {
    const storedUser = localStorage.getItem('usuarioLogado');
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            if (parsedUser.id && parsedUser.nome) {
                console.log("Usuário já logado, redirecionando para o dashboard...");
                window.location.href = '../index/index.html'; // Redireciona
                return true; // Retorna true para parar a execução
            }
        } catch (e) {
            localStorage.removeItem('usuarioLogado'); // Limpa dados inválidos
        }
    }
    console.log("Nenhum usuário logado. Exibindo página de login.");
    return false; // Retorna false se não estiver logado
}


// Adiciona listeners aos formulários e botões
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verifica se já está logado. Se estiver, interrompe a configuração dos listeners.
    if (checkIfLoggedIn()) {
        return; 
    }

    // 2. Se não estiver logado, configura os formulários e botões de alternância
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleToRegister = document.getElementById('toggle-register');
    const toggleToLogin = document.getElementById('toggle-login');
    const toggleRegisterContainer = document.getElementById('toggle-register-container');
    const toggleLoginContainer = document.getElementById('toggle-login-container');
    
    // Botão Convidado (guest-login-btn) foi removido do HTML, então não é mais necessário

    if (loginForm) loginForm.addEventListener('submit', (e) => handleAuth(e, false));
    if (registerForm) registerForm.addEventListener('submit', (e) => handleAuth(e, true));

    // Lógica para alternar formulários (Corrigido para funcionar com os IDs e classes)
    if (toggleToRegister && toggleToLogin && loginForm && registerForm && toggleRegisterContainer && toggleLoginContainer) {
        
        // Estado inicial (Mostra Login, Esconde Cadastro)
        registerForm.classList.add('hidden');
        toggleLoginContainer.classList.add('hidden');
        
        // CORREÇÃO 2: Botão de alternância agora funciona
        toggleToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            toggleRegisterContainer.classList.add('hidden');
            
            registerForm.classList.remove('hidden');
            toggleLoginContainer.classList.remove('hidden');
        });

        toggleToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('hidden');
            toggleLoginContainer.classList.add('hidden');
            
            loginForm.classList.remove('hidden');
            toggleRegisterContainer.classList.remove('hidden');
        });
    } else {
        console.warn("Elementos de formulário ou botões de alternância não encontrados.");
    }
});

