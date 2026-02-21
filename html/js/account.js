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
                .select('email, full_name, is_admin')
                .eq('id', userId)
                .maybeSingle();

            if (!idError && userById) {
                userData = userById;
            }
        }

        if (!userData) {
            console.warn('User not found in DB, using cached data');
            // Instead of showing a scary error, we just show what we have in the session
            renderProfile(sessionName, sessionEmail);
            return;
        }

        // 3. Render content (database data or fallback)
        if (!userData) {
            console.warn('User not found in DB, using cached data');
            renderProfile(sessionName, sessionEmail);
        } else {
            renderProfile(userData.full_name, userData.email);
        }

        // 4. Check for admin and render button (Bulletproof check via RPC)
        let isAdmin = false;
        let debugSource = "None";

        // Check if we already know they are admin via cache or userData
        if (userData && userData.is_admin) {
            isAdmin = true;
            debugSource = "Database (users table)";
        } else if (cachedUser.is_admin) {
            isAdmin = true;
            debugSource = "Local Cache (localStorage)";
        } else if (userId) {
            // Otherwise, use the exact same secure RPC method as admin.js
            try {
                const { data: rpcAdmin, error: rpcError } = await supabase.rpc('check_is_admin', {
                    check_user_id: userId
                });
                isAdmin = !!rpcAdmin;
                debugSource = `RPC Check (Value: ${rpcAdmin} | Error: ${rpcError ? rpcError.message : 'None'})`;
            } catch (e) {
                debugSource = `RPC Failed: ${e.message}`;
            }
        }

        // --- TEMPORARY DEBUG MESSAGE ---
        const debugMsg = document.getElementById('status-message');
        if (debugMsg) {
            debugMsg.textContent = `DEBUG -> is_admin: ${isAdmin} | Source: ${debugSource}`;
            debugMsg.style.color = 'blue';
            debugMsg.style.display = 'block';
        }
        // -------------------------------

        if (isAdmin) {
            const adminContainer = document.getElementById('admin-container');
            if (adminContainer) {
                adminContainer.innerHTML = `
                    <a href="admin.html" class="btn" style="background: #333; color: white; display: block; text-align: center; margin-bottom: 0.5rem; text-decoration: none; padding: 0.75rem; border-radius: 6px; font-weight: bold;">
                        Admin Dashboard
                    </a>
                `;
            }
        }

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

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = './index.html';
    });
}

document.addEventListener('DOMContentLoaded', init);

