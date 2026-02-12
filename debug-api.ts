async function debug() {
    console.log('Logging in...');
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@csnworld.com', password: 'password123' }),
    });

    if (!loginRes.ok) {
        console.error('Login failed:', await loginRes.text());
        return;
    }

    const cookie = loginRes.headers.get('set-cookie');
    console.log('Login successful, fetching users...');

    const usersRes = await fetch('http://localhost:3000/api/users?page=1&limit=20', {
        headers: {
            'cookie': cookie || '',
        },
    });

    console.log('Response Status:', usersRes.status);
    const data = await usersRes.json();
    console.log('Response Body:', JSON.stringify(data, null, 2));
}

debug();
