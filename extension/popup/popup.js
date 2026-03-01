// Popup script for Lumina Insight

document.addEventListener('DOMContentLoaded', () => {
  const greetBtn = document.getElementById('greet-btn');
  const status = document.getElementById('status');

  greetBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GREET' });
      status.textContent = response.greeting;
    } catch (error) {
      console.error('Error sending message:', error);
      status.textContent = 'Could not reach background service.';
    }
  });
});
