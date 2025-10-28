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
    // ID do elemento de mensagem no 'cad_usuario.html'
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


// --- LÓGICA DE CADASTRO (API Express/MySQL) ---

/**
 * Função principal para lidar com o envio do formulário de cadastro.
 * @param {Event} event - O evento de submit.
 */
async function handleRegister(event) {
    event.preventDefault(); // Impede o refresh da página

    // IDs dos inputs no 'cad_usuario.html'
    const emailInput = document.getElementById('email-register');
    const passwordInput = document.getElementById('senha-register');
    const nomeInput = document.getElementById('nome-register');

    const email = emailInput ? emailInput.value.trim() : null;
    const password = passwordInput ? passwordInput.value : null; // A variável local ainda é 'password'
    const nome = nomeInput ? nomeInput.value.trim() : null;

    if (!email || !password || !nome) {
        displayMessage("Por favor, preencha todos os campos.", "warning");
        return;
    }

    displayMessage("Processando registro...", "info");
    const submitButton = event.target.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true;

    try {
        // Envia para a rota /cadastro do app.js
        const response = await fetch(`${API_URL}/cadastro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // CORREÇÃO: Alinha a chave JSON com o que o app.js espera ('senha')
            body: JSON.stringify({ nome: nome, email: email, senha: password }) 
        });

        const data = await response.json(); // Tenta ler o JSON da resposta

        if (response.ok) { // Status 201 (Created)
            displayMessage("Cadastro realizado com sucesso! Redirecionando para o login...", "success");

            // Redireciona para o Login
            setTimeout(() => {
                window.location.href = '../login/login.html'; 
            }, 1000); 

        } else {
            // Erro do servidor (ex: 409 Email já cadastrado, 500 Erro interno)
            throw new Error(data.message || "Ocorreu um erro no servidor.");
        }

    } catch (error) {
        console.error("Erro no cadastro:", error);
        displayMessage(`Falha no cadastro: ${error.message}`, "danger");
        if(submitButton) submitButton.disabled = false; // Reabilita o botão
    }
}

// --- INICIALIZAÇÃO DA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    // Esta página não precisa de verificação de login, 
    // pois é usada para criar uma conta.

    const registerForm = document.getElementById('register-form');
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    } else {
        // Este erro não deve mais acontecer se o HTML estiver correto
        console.error("Formulário 'register-form' não encontrado.");
    }
});

