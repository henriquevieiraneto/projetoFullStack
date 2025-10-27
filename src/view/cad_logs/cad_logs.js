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
        
        // --- INÍCIO DO CÓDIGO DA PÁGINA (Se Autenticado) ---

        // Função para exibir mensagens na UI
        function displayLogMessage(message, type = 'danger') {
            const mensagemDiv = document.getElementById('message-box'); // ID da div de mensagem no HTML
            if (mensagemDiv) {
                mensagemDiv.textContent = message;
                // Aplica classes de cores Bootstrap
                mensagemDiv.className = `p-3 rounded-lg text-center text-sm ${
                    type === 'success' ? 'alert alert-success' :
                    type === 'info' ? 'alert alert-info' :
                    'alert alert-danger' 
                }`;
                mensagemDiv.classList.remove('hidden'); 
            } else {
                console.error(`ALERTA (${type}): ${message}`); // Fallback para console
            }
        }

        // Adiciona listener ao formulário
        document.addEventListener('DOMContentLoaded', () => {
             const formLog = document.getElementById('log-form'); // ID do formulário no HTML
             const userInfoElement = document.getElementById('user-info'); // Onde mostrar info do user

             if(userInfoElement && usuario.nome){
                 userInfoElement.textContent = `Registrando log para: ${usuario.nome}`;
             }

            if (formLog) {
                formLog.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    const btnSubmit = e.target.querySelector('button[type="submit"]');

                    // Coleta todos os dados do formulário (IDs dos inputs no HTML)
                    const dadosLog = {
                        titulo: document.getElementById('titulo').value,
                        categoria: document.getElementById('categoria').value,
                        horas_trabalhadas: document.getElementById('horas_trabalhadas').value,
                        linhas_codigo: document.getElementById('linhas_codigo').value || 0, // Envia 0 se vazio
                        bugs_corrigidos: document.getElementById('bugs_corrigidos').value || 0, // Envia 0 se vazio
                        descricao: document.getElementById('descricao').value,
                        // Adiciona ID e Data (gerada no JS)
                        id_usuario: usuario.id,
                        data_log: new Date().toISOString().split('T')[0] // Formato YYYY-MM-DD
                    };

                    console.log("Dados do Log a serem enviados:", dadosLog);

                    // Validação simples
                    if (!dadosLog.titulo || !dadosLog.categoria || !dadosLog.horas_trabalhadas || !dadosLog.descricao) {
                         displayLogMessage("Preencha todos os campos obrigatórios.", "warning");
                         return;
                    }

                    // Feedback visual e trava botão
                    btnSubmit.disabled = true;
                    btnSubmit.innerHTML = `
                        <i class="fas fa-spinner fa-spin me-2"></i>
                        Registrando...`;
                    displayLogMessage("Enviando log para o servidor...", "info");

                    try {
                        // Envio para o Backend (rota POST /logs)
                        const response = await fetch('http://localhost:3000/logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(dadosLog)
                        });

                        let responseData;
                        try {
                            responseData = await response.json();
                        } catch (e) {
                            responseData = { message: await response.text() }; // Se não for JSON
                        }

                        if (response.ok) { // Status 200-299
                            displayLogMessage(responseData.message || "Log registrado com sucesso!", "success");
                            formLog.reset(); // Limpa o formulário

                            // REDIRECIONAMENTO PARA O DASHBOARD APÓS SUCESSO
                            setTimeout(() => {
                                // Caminho absoluto para a pasta index
                                window.location.href = '/src/view/index/index.html';
                            }, 1000);

                        } else {
                            // Erro do servidor (4xx, 5xx)
                            const errorMessage = responseData.errorDetail || responseData.message || `Erro desconhecido (Status ${response.status}).`;
                            displayLogMessage(`Falha no registro: ${errorMessage}`, "danger");
                            console.error("Erro detalhado do servidor:", responseData);
                        }

                    } catch (error) {
                        // Erro de rede (fetch falhou)
                        console.error("Erro de conexão ao registrar log:", error);
                        displayLogMessage(`Falha na conexão com o servidor. Verifique se ele está rodando.`, "danger");
                    } finally {
                        // Reabilita o botão e restaura o texto
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = 'Registrar Log';
                    }
                });
            } else {
                 console.error("Formulário 'log-form' não encontrado no DOM.");
            }
        }); // Fim do DOMContentLoaded

        // --- FIM DO CÓDIGO DA PÁGINA ---

    } catch (error) {
        // Se houver erro ao ler/parsear 'usuarioLogado'
        console.error("Erro Crítico ao inicializar cad_logs.js:", error);
        localStorage.removeItem('usuarioLogado'); // Limpa dados corrompidos
        window.location.href = '../login/login.html'; // Força o login
    }
}
