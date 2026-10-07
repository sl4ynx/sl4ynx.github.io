const gate = document.getElementById('agegate');
if (localStorage.getItem('age-ok') === '1') gate.classList.add('hidden');
document.getElementById('enter').addEventListener('click', () => {
  localStorage.setItem('age-ok', '1');
  gate.classList.add('hidden');
});
