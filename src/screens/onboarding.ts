export interface OnboardingData {
  nickname: string;
  grade: number | null;
}

export let state: OnboardingData = {
  nickname: '',
  grade: null,
};

export function renderOnboarding(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'onboarding-screen';
  container.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-logo">🧠</div>
      <h1 class="onboarding-title">MentorAI</h1>
      <p class="onboarding-subtitle">Learn anywhere. Even offline.</p>
      
      <div class="form-group">
        <label class="form-label" for="nickname-input">What should we call you?</label>
        <input 
          type="text" 
          id="nickname-input"
          class="form-input" 
          placeholder="Enter your nickname"
          maxlength="20"
        >
      </div>
      
      <div class="grade-group">
        <label class="form-label">Select your grade</label>
        <div class="grade-buttons">
          <button class="grade-btn" data-grade="6">6</button>
          <button class="grade-btn" data-grade="7">7</button>
          <button class="grade-btn" data-grade="8">8</button>
        </div>
      </div>
      
      <button class="btn-primary" id="start-btn" disabled>
        Start Learning →
      </button>
    </div>
  `;

  const nicknameInput = container.querySelector('#nickname-input') as HTMLInputElement;
  const startBtn = container.querySelector('#start-btn') as HTMLButtonElement;
  const gradeBtns = container.querySelectorAll('.grade-btn');

  nicknameInput?.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    state.nickname = target.value.trim();
    updateStartButton();
  });

  gradeBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const grade = parseInt(target.dataset.grade || '0');
      state.grade = grade;
      gradeBtns.forEach((b) => b.classList.remove('selected'));
      target.classList.add('selected');
      updateStartButton();
    });
  });

  startBtn?.addEventListener('click', () => {
    if (state.nickname && state.grade) {
    }
  });

  function updateStartButton() {
    if (startBtn) {
      startBtn.disabled = !state.nickname || !state.grade;
    }
  }

  return container;
}

export function showOnboarding(): void {
  document.body.appendChild(renderOnboarding());
}