import { supabase } from './supabase-config.js';

const app = document.getElementById('app');

async function loadView(viewName) {
    try {
        const response = await fetch(`./components/${viewName}.html`);
        if (!response.ok) throw new Error();
        app.innerHTML = await response.text();
        if (viewName === 'auth') initAuth();
        if (viewName === 'chat') initChat();
    } catch (e) {
        app.innerHTML = `<h2 style="color:red;text-align:center;">Ошибка загрузки ${viewName}</h2>`;
    }
}

function initAuth() {
    const loginBtn = document.getElementById('loginBtn');
    const regBtn = document.getElementById('regBtn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Кнопка входа (проверяем, есть ли она)
    if (loginBtn) {
        loginBtn.onclick = async () => {
            const { error } = await supabase.auth.signInWithPassword({
                email: emailInput.value,
                password: passwordInput.value
            });
            if (error) alert('Ошибка: ' + error.message);
        };
    }

    // Кнопка регистрации (теперь, если её нет в HTML, код не упадет)
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

async function initChat() {
    const { data: { user } } = await supabase.auth.getUser();
    const win = document.querySelector('.messages-window');
    
    document.getElementById('logoutBtn').onclick = () => supabase.auth.signOut();

    const render = (msg) => {
        const div = document.createElement('div');
        const isMy = msg.user_id === user.id;
        div.className = `msg ${isMy ? 'my-msg' : 'other-msg'}`;
        const time = new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        div.innerHTML = `<div style="font-size:0.7em; opacity:0.6;">${msg.user_email.split('@')[0]} • ${time}</div>${msg.text}`;
        win.appendChild(div);
        win.scrollTop = win.scrollHeight;
    };

    const { data } = await supabase.from('messages').select('*').order('created_at');
    if (data) data.forEach(render);

    document.getElementById('sendBtn').onclick = async () => {
        const input = document.getElementById('msgInput');
        if (!input.value.trim()) return;
        await supabase.from('messages').insert([{ text: input.value, user_id: user.id, user_email: user.email }]);
        input.value = '';
    };

    supabase.channel('room1').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => render(p.new)).subscribe();
}

supabase.auth.onAuthStateChange((event, session) => {
    loadView(session ? 'chat' : 'auth');
});