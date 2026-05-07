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
        app.innerHTML = `<h2 style="color:red;text-align:center;">Ошибка загрузки интерфейса</h2>`;
    }
}

function initAuth() {
    document.getElementById('guestBtn').onclick = async () => {
        await supabase.auth.signInAnonymously();
    };
}

async function initChat() {
    const { data: { user } } = await supabase.auth.getUser();
    const win = document.querySelector('.messages-window');
    const sendBtn = document.getElementById('sendBtn');
    const msgInput = document.getElementById('msgInput');
    const fileInput = document.getElementById('fileInput');
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) logoutBtn.onclick = () => supabase.auth.signOut();

    const renderedIds = new Set();

    const render = (msg) => {
        if (msg.id && renderedIds.has(msg.id)) return;
        if (msg.id) renderedIds.add(msg.id);

        const div = document.createElement('div');
        const isMy = msg.user_id === user.id;
        div.className = `msg ${isMy ? 'my-msg' : 'other-msg'}`;

        const name = msg.user_email ? msg.user_email.split('@')[0] : 'Гость';
        const time = new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

        let content = `<div>${msg.text}</div>`;
        
        // Проверка: является ли сообщение ссылкой на файл в Supabase
        // Название бакета в ссылке соответствует твоему Photos
        const isFile = msg.text.includes('/storage/v1/object/public/Photos/');
        
        if (isFile) {
            const isImg = msg.text.match(/\.(jpeg|jpg|gif|png)$/i);
            if (isImg) {
                content = `<img src="${msg.text}" onclick="window.open('${msg.text}')" title="Открыть оригинал">`;
            } else {
                content = `<a href="${msg.text}" target="_blank" class="file-attachment">📄 Документ</a>`;
            }
        }

        div.innerHTML = `<div class="msg-info">${name} • ${time}</div>${content}`;
        win.appendChild(div);
        win.scrollTop = win.scrollHeight;
    };

    // 1. Загрузка истории
    const { data: history } = await supabase.from('messages').select('*').order('created_at');
    if (history) history.forEach(render);

    // 2. Отправка текста
    sendBtn.onclick = async () => {
        const text = msgInput.value.trim();
        if (!text) return;
        msgInput.value = '';
        await supabase.from('messages').insert([{ text, user_id: user.id, user_email: user.email }]);
    };

    // 3. Отправка файлов
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('Файл слишком большой (макс 5МБ)');
            return;
        }

        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${user.id}/${fileName}`;

        try {
            // Загружаем в бакет Photos
            const { error: upErr } = await supabase.storage
                .from('Photos') 
                .upload(filePath, file);

            if (upErr) throw upErr;

            const { data: { publicUrl } } = supabase.storage
                .from('Photos')
                .getPublicUrl(filePath);

            await supabase.from('messages').insert([{ 
                text: publicUrl, 
                user_id: user.id, 
                user_email: user.email 
            }]);

        } catch (err) {
            alert('Ошибка: ' + (err.message || 'Не удалось отправить'));
            console.error(err);
        } finally {
            fileInput.value = '';
        }
    };

    // 4. Слушаем новые сообщения в реальном времени
    supabase.channel('messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => render(p.new))
        .subscribe();
}

supabase.auth.onAuthStateChange((e, session) => loadView(session ? 'chat' : 'auth'));
