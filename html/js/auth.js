// Supabase login handler (browser ESM)

// This file expects a local `config.js` to export `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
// See `html/js/config.example.js` for the template. Do NOT commit your real key.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

const form = document.getElementById('login-form');
const msg = document.getElementById('login-message');

// 1. Load Configuration
async function loadConfig() {
    try {
        // dynamic import so the file can be gitignored and absent in the repo
        const cfg = await import('./config.js');
        if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
            throw new Error('Invalid config');
        }
        return { url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY };
    } catch (err) {
        return null;
    }
}

// 2. Initialize Supabase Client
async function ensureClient() {
    if (supabase) return supabase;
    const cfg = await loadConfig();
    if (!cfg) {
        if (msg) {
            msg.style.color = 'orange';
            msg.textContent = 'Missing Supabase config. Copy html/js/config.example.js → html/js/config.js';
        }
        throw new Error('Missing Supabase config');
    }
    supabase = createClient(cfg.url, cfg.key);
    return supabase;
}

// Helper: query the `users` table for a given email
async function getUserByEmail(email) {
    await ensureClient();
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .limit(1)
            .single();
        return { data, error };
    } catch (err) {
        return { data: null, error: err };
    }
}

// 3. Handle Login Form Submission
if (form) {
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();

        // Reset message state
        if (msg) {
            msg.style.color = '';
            msg.textContent = 'Logging in...';
        }

        const email = form.email?.value?.trim();
        const password = form.password?.value;

        // Basic validation
        if (!email || !password) {
            console.log('Login unsuccessful');
            if (msg) {
                msg.style.color = 'red';
                msg.textContent = 'Please provide both email and password.';
            }
            return;
        }

        try {
            await ensureClient();

            // Prefer the custom 'login_user' RPC for server-side verification
            let rpcData = null;
            let rpcError = null;
            try {
                const res = await supabase.rpc('login_user', {
                    login_email: email,
                    login_password: password,
                });
                rpcData = res.data;
                rpcError = res.error;
            } catch (e) {
                rpcData = null;
                rpcError = e;
            }

            console.debug('Supabase RPC login_user result:', { data: rpcData, error: rpcError });

            if (rpcError || !rpcData) {
                // Fallback: check whether a user row exists in the `users` table
                const { data: userRow, error: userErr } = await getUserByEmail(email);
                console.debug('Fallback users query result:', { userRow, userErr });

                if (userErr || !userRow) {
                    console.error('Login failed (RPC + no user):', rpcError || userErr);
                    if (msg) {
                        msg.style.color = 'red';
                        msg.textContent = 'Email of wachtwoord is incorrect.';
                    }
                    return;
                }

                // User exists but RPC authentication failed. Don't verify password client-side.
                console.warn('User exists but RPC login failed; server-side verification required.');
                if (msg) {
                    msg.style.color = 'orange';
                    msg.textContent = 'Gebruiker gevonden, maar inloggen mislukt (server verificatie). Neem contact op met de beheerder.';
                }
                return;
            }

            if (msg) {
                msg.style.color = 'green';
                msg.textContent = 'Succesvol ingelogd';
            }

            console.log('Login successful');

            // Save user and redirect
            localStorage.setItem('currentUser', JSON.stringify(rpcData));
            setTimeout(() => { window.location.href = './home.html'; }, 700);

        } catch (err) {
            console.error('Unexpected error:', err);
            console.log('Login unsuccessful');
            if (msg) {
                msg.style.color = 'red';
                msg.textContent = `Er is een fout opgetreden: ${err?.message || String(err)}`;
            }
        }
    });
}
