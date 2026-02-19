import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

async function loadConfig() {
    try {
        const cfg = await import('./config.js');
        return { url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY };
    } catch (err) {
        console.error('Config load error:', err);
        return null;
    }
}

async function ensureClient() {
    if (supabase) return supabase;
    const cfg = await loadConfig();
    if (!cfg) throw new Error('Kon Supabase-configuratie niet laden.');
    supabase = createClient(cfg.url, cfg.key);
    return supabase;
}

const profileContent = document.getElementById('profile-content');
const statusMsg = document.getElementById('status-message');
const changePasswordBtn = document.getElementById('change-password-btn');

function showStatus(message, isError = false) {
    statusMsg.textContent = message;
    statusMsg.style.color = isError ? 'red' : 'green';
    statusMsg.style.fontWeight = 'bold';
}

function renderProfile(name, email) {
    profileContent.innerHTML = `
        <div class="info-group">
            <label>Naam</label>
            <div class="info-value">${name || 'Niet opgegeven'}</div>
        </div>
        <div class="info-group">
            <label>E-mailadres</label>
            <div class="info-value">${email || 'Niet opgegeven'}</div>
        </div>
    `;
}

async function init() {
    // 1. Check login
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
        window.location.href = './index.html';
        return;
    }

    const cachedUser = JSON.parse(userStr);
    console.debug('Cached user session:', cachedUser);

    // Try multiple keys for email and name as they might vary depending on how login was performed
    const sessionEmail = cachedUser.email || cachedUser.login_email;
    const sessionName = cachedUser.full_name || cachedUser.display_name || cachedUser.name;
    const userId = cachedUser.id;

    try {
        await ensureClient();

        let userData = null;

        // 2. Fetch latest data from 'users' table
        // First try by ID if available (most reliable)
        if (userId) {
            const { data: userById, error: idError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('id', userId)
                .maybeSingle();

            if (!idError && userById) {
                userData = userById;
            }
        }

        // If not found by ID, try by email
        if (!userData && sessionEmail) {
            const { data: userByEmail, error: emailError } = await supabase
                .from('users')
                .select('email, full_name')
                .ilike('email', sessionEmail)
                .limit(1);

            if (!emailError && userByEmail && userByEmail.length > 0) {
                userData = userByEmail[0];
            }
        }

        if (!userData) {
            console.warn('User not found in DB, using cached data');
            // Instead of showing a scary error, we just show what we have in the session
            renderProfile(sessionName, sessionEmail);
            return;
        }

        // 3. Render content from database
        renderProfile(userData.full_name, userData.email);

    } catch (err) {
        console.error('Init error:', err);
        // Fallback to session data on any error
        renderProfile(sessionName, sessionEmail);
    }
}

// Redirect to change password
if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => {
        window.location.href = './change-password.html';
    });
}

document.addEventListener('DOMContentLoaded', init);
