// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://ksclrsmvfhohejfnsizz.supabase.co' // Твой URL из настроек
const SUPABASE_KEY = 'sb_publishable_qTxuEYcoKXMbDQ6eL6cL9A_6rc6O6Ov'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Делаем клиент доступным глобально, чтобы обращаться к нему из других файлов
window.supabase = supabase