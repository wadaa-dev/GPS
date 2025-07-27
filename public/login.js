document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  
  const loginButton = document.querySelector('button[type="submit"]');
  loginButton.disabled = true;
  loginButton.textContent = 'جاري التحقق...';

  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      localStorage.setItem('token', data.token);
      window.location.href = '/map.html'; 
    } else {
      alert('بيانات خاطئة');
    }
  })
  .catch(err => {
    alert('حدث خطأ أثناء الاتصال بالخادم');
  })
  .finally(() => {
    
    loginButton.disabled = false;
    loginButton.textContent = 'دخول';
  });
});
