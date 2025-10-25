// Arquivo: src/view/cad_usuario.js

document.getElementById('frmCadUsuario').addEventListener('submit', async (e) => {
    e.preventDefault();

    const mensagemDiv = document.getElementById('mensagem');
    const btnSubmit = e.target.querySelector('button[type="submit"]');

    // 1. Coleta dos dados do formulário (APENAS campos do DB: nome, email, senha)
    const dadosUsuario = {
        nome: document.getElementById('inputNome').value,
        email: document.getElementById('inputEmail').value,
        senha: document.getElementById('inputSenha').value
    };

    // 2. Trava o botão e exibe mensagem de carregamento
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Registrando...';
    mensagemDiv.className = 'mt-3 text-center small text-info';
    mensagemDiv.textContent = 'Enviando dados para o servidor...';

    try {
        // CORREÇÃO CRÍTICA: Rota alterada de /registrar para /cadastro
        const response = await fetch('http://localhost:3000/cadastro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dadosUsuario)
        });

        let data;
        // Tenta ler a resposta como JSON
        try {
            data = await response.json();
        } catch (e) {
            // Se falhar (ex: corpo vazio), define uma mensagem de erro com o status
            data = { message: `Erro: ${response.status} ${response.statusText}` };
        }

        if (response.ok) {
            // Cadastro de sucesso (Status 200/201)
            mensagemDiv.className = 'mt-3 text-center small text-success';
            mensagemDiv.textContent = 'Usuário cadastrado com sucesso! Redirecionando para o login...';
            
            // 4. REDIRECIONAMENTO PARA A PÁGINA DE LOGIN
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500); 

        } else if (response.status === 409) {
            // Erro 409 Conflict (e-mail já cadastrado)
            mensagemDiv.className = 'mt-3 text-center small text-danger';
            mensagemDiv.textContent = `Falha no cadastro: ${data.message || 'E-mail já cadastrado.'}`;
        } else {
            // Outro erro de servidor (ex: 500 Internal Server Error)
            mensagemDiv.className = 'mt-3 text-center small text-danger';
            mensagemDiv.textContent = `Falha no cadastro: ${data.message || `Erro desconhecido. Status: ${response.status}`}.`;
        }
    } catch (error) {
        console.error("Erro ao cadastrar usuário:", error);
        mensagemDiv.className = 'mt-3 text-center small text-danger';
        mensagemDiv.textContent = `Falha no cadastro: ${error.message}. Verifique o console.`;
    } finally {
        // 5. Destrava o botão
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Cadastrar';
    }
});