import { supabase } from './supabase-config.js';

const app = document.getElementById('app');

// --- 1. ЗАГРУЗКА ЭКРАНОВ ---
async function loadView(viewName) {
    const path = `./components/${viewName}.html`;
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error();
        app.innerHTML = await response.text();
        if (viewName === 'auth') initAuth();
        if (viewName === 'chat') initChat();
    } catch (e) {
        app.innerHTML = `<h2 style="color:red;text-align:center;padding:20px;">Ошибка: ${path} не найден</h2>`;
    }
}

// --- 2. ЛОГИКА ВХОДА ---
function initAuth() {
    const loginBtn = document.getElementById('loginBtn');
    const regBtn = document.getElementById('regBtn');
    const guestBtn = document.getElementById('guestBtn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (loginBtn) {
        loginBtn.onclick = async () => {
            const { error } = await supabase.auth.signInWithPassword({
                email: emailInput.value,
                password: passwordInput.value
            });
            if (error) alert('Ошибка: ' + error.message);
        };
    }

    if (guestBtn) {
        guestBtn.onclick = async () => {
            const { error } = await supabase.auth.signInAnonymously();
            if (error) alert('Ошибка гостевого входа: ' + error.message);
        };
    }

    if (regBtn) {
        regBtn.onclick = async () => {
            const { error } = await supabase.auth.signUp({
                email: emailInput.value,
                password: passwordInput.value
            });
            if (error) alert(error.message); 
            else alert('Проверь почту!');
        };
    }
}

// --- 3. ЛОГИКА ЧАТА (БЕЗ ВИЗУАЛЬНЫХ ПРЫЖКОВ) ---
async function initChat() {
    const { data: { user } } = await supabase.auth.getUser();
    const win = document.querySelector('.messages-window');
    const sendBtn = document.getElementById('sendBtn');
    const msgInput = document.getElementById('msgInput');
    const logoutBtn = document.getElementById('logoutBtn');

    if (sendBtn) sendBtn.onclick = null;
    supabase.removeAllChannels();
    if (logoutBtn) logoutBtn.onclick = () => supabase.auth.signOut();

    const renderedIds = new Set();

    const render = (msg, isOptimistic = false) => {
        // Если это подтверждение от сервера для уже отрисованного сообщения
        if (msg.id && renderedIds.has(msg.id)) return;

        // Поиск временного сообщения, чтобы связать его с реальным ID
        const existingTemp = Array.from(document.querySelectorAll('.msg-temp'))
                                  .find(el => el.getAttribute('data-text') === msg.text);

        if (existingTemp && msg.id) {
            existingTemp.classList.remove('msg-temp');
            renderedIds.add(msg.id);
            return; // Просто "привязали" ID, не создавая новый элемент
        }

        if (msg.id) renderedIds.add(msg.id);

        const div = document.createElement('div');
        const isMy = msg.user_id === user.id;
        div.className = `msg ${isMy ? 'my-msg' : 'other-msg'}`;
        
        // Добавляем маркер для временных сообщений
        if (isOptimistic) {
            div.classList.add('msg-temp');
            div.setAttribute('data-text', msg.text);
        }

        const name = msg.user_email ? msg.user_email.split('@')[0] : 'Гость';
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        div.innerHTML = `
            <div style="font-size:0.7em; opacity:0.6; margin-bottom:4px;">${name} • ${time}</div>
            <div>${msg.text}</div>
        `;
        win.appendChild(div);
        win.scrollTop = win.scrollHeight;
    };

    // Загрузка истории
    const { data: history } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (history) {
        win.innerHTML = ''; 
        history.forEach(render);
    }

    // Мгновенная отправка (один цвет для всех)
    if (sendBtn) {
        sendBtn.onclick = async () => {
            const text = msgInput.value.trim();
            if (!text) return;

            const tempMsg = {
                text: text,
                user_id: user.id,
                user_email: user.email,
                created_at: new Date().toISOString()
            };
            
            render(tempMsg, true); // Появится сразу с нормальным цветом
            msgInput.value = '';

            await supabase.from('messages').insert([
                { text: text, user_id: user.id, user_email: user.email }
            ]);
        };
    }

    // Realtime подписка
    supabase.channel('room1').on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
    }, payload => {
        render(payload.new);
    }).subscribe();
}

// --- 4. МОНИТОРИНГ СОСТОЯНИЯ ---
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        loadView('chat');
    } else {
        loadView('auth');
    }
});
