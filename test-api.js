
async function test() {
    try {
        console.log('Testing GET /api/chapters/8f64319e-b24c-4a34-b91c-c210d05db090/meetings');
        const res = await fetch('http://localhost:3000/api/chapters/8f64319e-b24c-4a34-b91c-c210d05db090/meetings');
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text.substring(0, 500));
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
