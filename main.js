import { supabase } from './supabase-config.js';

const app = document.getElementById('app');

// --- 1. ЗАГРУЗКА ЭКРАНОВ ---
async function loadView(viewName) {
    const path = `./components/${viewName}.html`;
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error();
        app.innerHTML = await response.text();
        
        // Инициализируем логику в зависимости от экрана
        if (viewName === 'auth') initAuth();
        if (viewName === 'chat') initChat();
    } catch (e) {
        app.innerHTML = `<h2 style="color:red;text-align:center;padding:20px;">Ошибка: Файл ${path} не найден</h2>`;
    }
}

// --- 2. ЛОГИКА АВТОРИЗАЦИИ (ОБЪЕДИНЕННАЯ) ---
function initAuth() {
    const loginBtn = document.getElementById('loginBtn');
    const regBtn = document.getElementById('regBtn');
    const guestBtn = document.getElementById('guestBtn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Вход по почте
    if (loginBtn) {
        loginBtn.onclick = async () => {
            const { error } = await supabase.auth.signInWithPassword({
                email: emailInput.value,
                password: passwordInput.value
            });
            if (error) alert('Ошибка: ' + error.message);
        };
    }

    // Регистрация
    if (regBtn) {
        regBtn.onclick = async () => {
            const { error } = await supabase.auth.signUp({
                email: emailInput.value,
                password: passwordInput.value
            });
            if (error) alert(error.message); 
            else alert('Успех! Проверь почту для подтверждения.');
        };
    }

    // Гостевой вход (Анонимный)
    if (guestBtn) {
        guestBtn.onclick = async () => {
            const { error } = await supabase.auth.signInAnonymously();
            if (error) alert('Ошибка гостевого входа: ' + error.message);
        };
    }
}

// --- 3. ЛОГИКА ЧАТА (С ЗАЩИТОЙ ОТ ДУБЛЕЙ) ---
async function initChat() {
    const { data: { user } } = await supabase.auth.getUser();
    const win = document.querySelector('.messages-window');
    const sendBtn = document.getElementById('sendBtn');
    const msgInput = document.getElementById('msgInput');
    const logoutBtn = document.getElementById('logoutBtn');

    // Очищаем старые подписки и события перед началом
    if (sendBtn) sendBtn.onclick = null;
    supabase.removeAllChannels();

    if (logoutBtn) {
        logoutBtn.onclick = () => supabase.auth.signOut();
    }

    // Функция отрисовки сообщения
    const render = (msg) => {
        if (!win) return;
        const div = document.createElement('div');
        const isMy = msg.user_id === user.id;
        div.className = `msg ${isMy ? 'my-msg' : 'other-msg'}`;
        
        // Если почты нет (гость), пишем "Гость"
        const name = msg.user_email ? msg.user_email.split('@')[0] : 'Гость';
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        div.innerHTML = `
            <div style="font-size:0.7em; opacity:0.6; margin-bottom:4px;">${name} • ${time}</div>
            <div>${msg.text}</div>
        `;
        win.appendChild(div);
        win.scrollTop = win.scrollHeight;
    };

    // Загружаем историю сообщений
    const { data: history } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (history) {
        win.innerHTML = ''; // Очищаем экран перед загрузкой истории
        history.forEach(render);
    }

    // Отправка сообщения
    if (sendBtn) {
        sendBtn.onclick = async () => {
            const text = msgInput.value.trim();
            if (!text) return;

            const { error } = await supabase.from('messages').insert([
                { 
                    text: text, 
                    user_id: user.id, 
                    user_email: user.email // Для гостя тут будет null, это нормально
                }
            ]);

            if (error) console.error('Ошибка отправки:', error);
            msgInput.value = '';
        };
    }

    // Подписка на новые сообщения в реальном времени
    supabase
        .channel('room1')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            render(payload.new);
        })
        .subscribe();
}

// --- 4. СЛУШАТЕЛЬ СОСТОЯНИЯ (ГЛАВНЫЙ) ---
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth Event:', event);
    if (session) {
        loadView('chat');
    } else {
        loadView('auth');
    }
});