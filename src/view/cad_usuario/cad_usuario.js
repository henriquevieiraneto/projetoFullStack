// Importações de Firebase (necessárias para as funções de criação de usuário)
// As importações reais são feitas pelas tags <script type="module"> no HTML correspondente.
// Estas linhas servem para clareza e simulação de dependências.
// import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
// import { createUserWithEmailAndPassword, getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variáveis globais (Firebsase SDKs)
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
let auth;
let db;

// Função para exibir mensagens na UI
function displayMessage(message, type = 'danger') {
    const mensagemStatus = document.getElementById('mensagemStatus');
    if (!mensagemStatus) {
        console.error("Elemento 'mensagemStatus' não encontrado no DOM.");
        return;
    }
    mensagemStatus.textContent = message;
    // Usa classes para estilo
    mensagemStatus.className = `text-center small font-medium mt-2 text-sm ${
        type === 'success' ? 'text-green-600' :
        type === 'info' ? 'text-blue-600' :
        type === 'warning' ? 'text-yellow-600' :
        'text-red-600' // Padrão é danger
    }`;
    setTimeout(() => {
        if (mensagemStatus) {
            mensagemStatus.textContent = '';
            mensagemStatus.className = 'text-center small font-medium mt-2';
        }
    }, 5000);
}

// Inicializa o Firebase (apenas o essencial para o cadastro)
function initFirebase() {
    try {
        if (Object.keys(firebaseConfig).length === 0) throw new Error("Configuração do Firebase vazia.");
        if (typeof firebase === 'undefined' || !firebase.getApps) {
             console.error("Firebase SDK não está carregado. Verifique os imports no HTML.");
             return;
        }

        if (firebase.getApps().length === 0) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
             app = firebase.getApp();
        }
        
        auth = firebase.getAuth(app);
        db = firebase.getFirestore(app);
    } catch (error) {
        console.error("Erro ao inicializar Firebase para Cadastro:", error);
        displayMessage("Erro crítico ao conectar com serviços de autenticação.", "danger");
    }
}

// Função para salvar dados extras no Firestore (nome, email)
async function saveUserData(userId, nome, email) {
    if (!db) return;
    try {
        const userRef = firebase.doc(db, "users", userId); // Coleção 'users'
        await firebase.setDoc(userRef, { nome: nome, email: email, createdAt: new Date() });
        console.log("Dados do usuário salvos no Firestore.");
    } catch (error) {
        console.error("Erro ao salvar dados no Firestore:", error);
    }
}

// Lógica principal de submissão do formulário de registro
async function handleRegister(event) {
    event.preventDefault();

    // Seleciona os inputs (IDs devem corresponder ao cad_usuario.html)
    const emailInput = document.getElementById('email-register');
    const passwordInput = document.getElementById('senha-register');
    const nomeInput = document.getElementById('nome-register');

    const email = emailInput ? emailInput.value.trim() : null;
    const password = passwordInput ? passwordInput.value : null;
    const nome = nomeInput ? nomeInput.value.trim() : '';

    if (!email || !password || !nome) {
        displayMessage("Por favor, preencha todos os campos.", "warning");
        return;
    }

    displayMessage("Registrando...", "info");
    const submitButton = event.target.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true;

    try {
        // 1. Cria o usuário no Firebase Auth (Assume que as funções Firebase estão no escopo global)
        const userCredential = await firebase.createUserWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;

        // 2. Salva os dados no Firestore
        await saveUserData(userId, nome, email);

        // 3. (Opcional) Envia dados para a API Backend (MySQL) para compatibilidade
        const backendResponse = await fetch('http://localhost:3000/cadastro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // A API de cadastro do seu projeto espera 'nome', 'email', 'senha'
            body: JSON.stringify({ nome: nome, email: email, senha: password }) 
        });
        
        if (!backendResponse.ok) {
            console.warn("Aviso: Falha ao registrar no MySQL/Backend, mas o Firebase Auth foi bem-sucedido.");
        }

        displayMessage("Cadastro realizado com sucesso! Redirecionando para login.", "success");
        
        // Redireciona para o login
        setTimeout(() => {
            // Caminho CORRETO para o login (../login/login.html)
            window.location.href = '../login/login.html';
        }, 1000);

    } catch (error) {
        console.error("Erro durante o registro:", error);
        
        let friendlyMessage = "Ocorreu um erro. Tente novamente.";
        if (error.code === 'auth/email-already-in-use') friendlyMessage = "Este email já está cadastrado.";
        else if (error.code === 'auth/weak-password') friendlyMessage = "A senha é muito fraca (mínimo 6 caracteres).";
        else if (error.code === 'auth/invalid-email') friendlyMessage = "O formato do email é inválido.";
        else if (error.code === 'auth/operation-not-allowed') friendlyMessage = "Operação não permitida. Verifique as configurações do Firebase.";

        displayMessage(`Falha no registro: ${friendlyMessage}`, "danger");
        if(submitButton) submitButton.disabled = false;
    }
}


// Adiciona listener ao formulário de registro
document.addEventListener('DOMContentLoaded', () => {
    initFirebase(); // Inicializa o Firebase

    // O HTML de cad_usuario só deve ter o formulário de registro
    const registerForm = document.getElementById('register-form'); 
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    } else {
        console.error("Formulário de registro ('register-form') não encontrado no DOM.");
    }
});
