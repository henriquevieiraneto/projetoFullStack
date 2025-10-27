// Importações de Firebase (garantindo que estão no escopo global via HTML)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- INÍCIO DA INICIALIZAÇÃO E CONFIGURAÇÃO ---

// Variáveis globais fornecidas pelo ambiente Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
// NOTA: initialAuthToken é tratado dentro do setupAuthListener
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app;
let auth;
let db;

// Função para exibir mensagens
function displayMessage(message, type = 'danger') {
    const mensagemStatus = document.getElementById('mensagemStatus');
    if (!mensagemStatus) {
        console.error("Elemento 'mensagemStatus' não encontrado no DOM.");
        return;
    }
    mensagemStatus.textContent = message;
    // Ajusta as classes para cores
    mensagemStatus.className = `text-center small font-medium mt-2 text-sm ${
        type === 'success' ? 'text-green-600' :
        type === 'info' ? 'text-blue-600' :
        type === 'warning' ? 'text-yellow-600' :
        'text-red-600' // danger é o padrão
    }`;
    setTimeout(() => {
        if (mensagemStatus) {
            mensagemStatus.textContent = '';
            mensagemStatus.className = 'text-center small font-medium mt-2';
        }
    }, 5000);
}

// Inicializa o Firebase
function initFirebase() {
    try {
        if (Object.keys(firebaseConfig).length === 0) throw new Error("Configuração do Firebase vazia.");
        if (typeof firebase === 'undefined' || !firebase.getApps) {
             console.error("Firebase SDK não está carregado. Verifique os imports no HTML.");
             return;
        }
        
        // Inicializa Firebase (se já inicializado, pega a instância existente)
        if (firebase.getApps().length === 0) {
            app = initializeApp(firebaseConfig);
        } else {
            app = firebase.getApp();
        }
        
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase inicializado com sucesso em login.js.");
        setupAuthListener(); // Configura o listener após a inicialização
    } catch (error) {
        console.error("Erro ao inicializar Firebase em login.js:", error);
        displayMessage("Erro crítico ao conectar com serviços de autenticação.", "danger");
    }
}

// --- FIM DA INICIALIZAÇÃO ---

// --- LÓGICA DE AUTENTICAÇÃO ---

// Função principal para lidar com login ou cadastro
async function handleAuth(event, isRegistering) {
    // CORREÇÃO 3: Garante que preventDefault() está aqui para evitar o loop de refresh
    event.preventDefault();

    // Seleciona os inputs corretos baseado se é login ou registro
    const emailInput = document.getElementById(isRegistering ? 'email-register' : 'email-login');
    const passwordInput = document.getElementById(isRegistering ? 'senha-register' : 'senha-login');
    const nomeInput = document.getElementById('nome-register'); // Só existe no registro

    const email = emailInput ? emailInput.value.trim() : null;
    const password = passwordInput ? passwordInput.value : null;
    const nome = isRegistering && nomeInput ? nomeInput.value.trim() : '';

    if (!email || !password || (isRegistering && !nome)) {
        displayMessage("Por favor, preencha todos os campos obrigatórios.", "warning");
        return;
    }

    displayMessage("Processando...", "info");

    // Desabilita o botão durante o processamento
    const submitButton = event.target.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true;

    try {
        let userCredential;
        let userName = nome; 

        if (isRegistering) {
            // Criar novo usuário
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log("Usuário criado:", userCredential.user.uid);
            await saveUserData(userCredential.user.uid, nome, email);
            displayMessage("Cadastro realizado! Redirecionando...", "success");
            
        } else {
            // Fazer login
            userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("Usuário logado:", userCredential.user.uid);

            // Busca nome do Firestore após login
            const userData = await getUserData(userCredential.user.uid);
            userName = userData ? userData.nome : (userCredential.user.email ? userCredential.user.email.split('@')[0] : "Usuário"); // Usa nome do DB ou fallback
            displayMessage(`Login bem-sucedido! Bem-vindo(a), ${userName}! Redirecionando...`, "success");
        }

        // Salva dados no localStorage
        saveToLocalStorage(userCredential.user.uid, userName);


        // Redireciona para o Dashboard após sucesso
        setTimeout(() => {
            // Caminho CORRETO para o dashboard (pasta index)
            window.location.href = '../index/index.html'; 
        }, 1000); 

    } catch (error) {
        console.error("Erro de autenticação:", error);
        
        let friendlyMessage = "Ocorreu um erro. Tente novamente.";
        if (error.code === 'auth/email-already-in-use') friendlyMessage = "Este email já está cadastrado.";
        else if (error.code === 'auth/invalid-email') friendlyMessage = "O formato do email é inválido.";
        else if (error.code === 'auth/weak-password') friendlyMessage = "A senha é muito fraca (mínimo 6 caracteres).";
        else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') friendlyMessage = "Email ou senha incorretos.";
        else if (error.code === 'auth/operation-not-allowed') friendlyMessage = "Operação não permitida. Verifique as configurações do Firebase.";

        displayMessage(`Falha: ${friendlyMessage}`, "danger");
        if(submitButton) submitButton.disabled = false; // Reabilita o botão
    }
}

// Função para buscar dados do usuário no Firestore
async function getUserData(userId) {
     if (!db) return null;
    try {
        // Caminho da coleção de usuários (exemplo: 'users')
        const userRef = doc(db, "users", userId);
        const docSnap = await firebase.getDoc(userRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Erro ao buscar dados do usuário no Firestore:", error);
        return null;
    }
}

// Função para salvar dados extras no Firestore (cadastro)
async function saveUserData(userId, nome, email) {
    if (!db) return;
    try {
        // Usa a coleção 'users' para armazenar dados adicionais
        const userRef = doc(db, "users", userId);
        await firebase.setDoc(userRef, { nome: nome, email: email, createdAt: new Date() });
        console.log("Dados do usuário salvos no Firestore.");
    } catch (error) {
        console.error("Erro ao salvar dados do usuário no Firestore:", error);
    }
}

// Função para salvar ID e Nome no localStorage
function saveToLocalStorage(userId, userName) {
    const userData = { id: userId, nome: userName };
    localStorage.setItem('usuarioLogado', JSON.stringify(userData));
    localStorage.removeItem('userId'); 
    localStorage.removeItem('userName'); 
    console.log("Dados salvos no localStorage:", userData);
}

// --- GERENCIAMENTO DE ESTADO DA UI E LISTENERS ---

// Listener para o estado de autenticação (redireciona se já logado)
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Firebase Auth: Usuário detectado:", user.uid);
            // Verifica se os dados JÁ estão no localStorage
            const storedUser = localStorage.getItem('usuarioLogado');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    // Redireciona apenas se o ID local bate com o ID do Firebase
                    if (parsedUser.id === user.uid) {
                        console.log("Dados locais consistentes. Redirecionando para o dashboard...");
                        window.location.href = '../index/index.html'; // Caminho CORRETO
                        return;
                    }
                } catch(e) { /* Segue o fluxo para buscar dados novamente */ }
            }

            // Se chegou aqui, os dados locais estão ausentes ou inválidos. Busca no Firestore.
            console.log("Buscando/confirmando dados do usuário no Firestore...");
            const userData = await getUserData(user.uid);
            const userName = userData ? userData.nome : (user.email ? user.email.split('@')[0] : "Usuário");

            // Salva os dados corretos e redireciona
            saveToLocalStorage(user.uid, userName);
            console.log("Dados atualizados no localStorage. Redirecionando...");
            window.location.href = '../index/index.html'; // Caminho CORRETO

        } else {
            console.log("Firebase Auth: Nenhum usuário logado.");
            // Garante limpeza do localStorage se deslogado no Firebase
            localStorage.removeItem('usuarioLogado');
        }
    });

     // Autenticação com token inicial (Canvas)
     if (initialAuthToken) {
         console.log("Tentando autenticar com token inicial...");
        signInWithCustomToken(auth, initialAuthToken)
            .then(() => console.log("Autenticado com token inicial."))
            .catch((error) => {
                console.error("Erro no token inicial:", error);
                displayMessage("Falha na autenticação automática. Por favor, faça login.", "warning");
            });
    } else {
         console.log("Nenhum token inicial encontrado. Aguardando login manual.");
    }
}


// Adiciona listeners aos formulários e botões quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    initFirebase(); // Inicializa Firebase PRIMEIRO

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleToRegister = document.getElementById('toggle-register');
    const toggleToLogin = document.getElementById('toggle-login');
    // Botão Convidado removido

    if (loginForm) loginForm.addEventListener('submit', (e) => handleAuth(e, false));
    // O formulário de registro (se estiver na mesma página)
    if (registerForm) registerForm.addEventListener('submit', (e) => handleAuth(e, true));

    // Lógica para alternar formulários
    if (toggleToRegister && toggleToLogin && loginForm && registerForm) {
        toggleToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            toggleToRegister.classList.add('hidden'); // Esconde "Cadastre-se!"
            toggleToLogin.classList.remove('hidden'); // Mostra "Fazer Login"
        });

        toggleToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
            toggleToLogin.classList.add('hidden'); // Esconde "Fazer Login"
            toggleToRegister.classList.remove('hidden'); // Mostra "Cadastre-se!"
        });
    } else {
        console.warn("Elementos de formulário ou botões de alternância não encontrados. A funcionalidade de alternar pode estar ausente ou o HTML não foi carregado.");
    }
});
