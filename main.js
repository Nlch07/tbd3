import { supabase } from './supabase-config.js';

const app = document.getElementById('app');

async function loadView(viewName) {
    const path = `./components/${viewName}.html`;
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error();
        app.innerHTML = await response.text();
        if (viewName === 'auth') initAuth();
        if (viewName === 'chat') initChat();
    } catch (e) {
        app.innerHTML = `<h2 style="color:red;text-align:center;">Ошибка: ${path} не найден</h2>`;
    }
}

function initAuth() {
    const guestBtn = document.getElementById('guestBtn');
    if (guestBtn) {
        guestBtn.onclick = async () => {
            const { error } = await supabase.auth.signInAnonymously();
            if (error) alert('Ошибка: ' + error.message);
        };
    }
    // Остальные кнопки (login, reg) как в прошлом коде...
}

async function initChat() {
    const { data: { user } } = await supabase.auth.getUser();
    const win = document.querySelector('.messages-window');
    const sendBtn = document.getElementById('sendBtn');
    const msgInput = document.getElementById('msgInput');

    sendBtn.onclick = null;
    supabase.removeAllChannels();

    const renderedIds = new Set();

    const render = (msg, isOptimistic = false) => {
        // Если это пришло из базы и такое сообщение уже есть (наше "серое" стало "ярким")
        if (msg.id && renderedIds.has(msg.id)) return;
        
        // Поиск временного сообщения по тексту (чтобы заменить его ярким)
        const existingTemp = Array.from(document.querySelectorAll('.msg-temp'))
                                  .find(el => el.innerText.includes(msg.text));

        if (existingTemp && msg.id) {
            existingTemp.classList.remove('msg-temp');
            existingTemp.style.opacity = '1';
            renderedIds.add(msg.id);
            return; // Не создаем новый элемент, просто "проявили" старый
        }

        if (msg.id) renderedIds.add(msg.id);

        const div = document.createElement('div');
        const isMy = msg.user_id === user.id;
        div.className = `msg ${isMy ? 'my-msg' : 'other-msg'} ${isOptimistic ? 'msg-temp' : ''}`;
        
        if (isOptimistic) div.style.opacity = '0.5';

        const name = msg.user_email ? msg.user_email.split('@')[0] : 'Гость';
        const time = new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        
        div.innerHTML = `<div style="font-size:0.7em; opacity:0.6;">${name} • ${time}</div>${msg.text}`;
        win.appendChild(div);
        win.scrollTop = win.scrollHeight;
    };

    // Загрузка истории
    const { data } = await supabase.from('messages').select('*').order('created_at');
    if (data) data.forEach(render);

    // ОТПРАВКА
    sendBtn.onclick = async () => {
        const text = msgInput.value.trim();
        if (!text) return;

        // Рисуем мгновенно
        render({
            text: text,
            user_id: user.id,
            user_email: user.email,
            created_at: new Date().toISOString()
        }, true);
        
        msgInput.value = '';

        await supabase.from('messages').insert([
            { text: text, user_id: user.id, user_email: user.email }
        ]);
    };

    // REALTIME
    supabase.channel('room1').on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
    }, p => render(p.new)).subscribe();
}

supabase.auth.onAuthStateChange((e, session) => loadView(session ? 'chat' : 'auth'));
