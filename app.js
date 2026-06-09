/**
 * PC Flex - Pubococcygeus Muscle Trainer
 * JavaScript Core Logic & Audio Synthesizer
 */

// --- STATE MANAGEMENT ---
const state = {
    currentTab: 'practice',
    currentLibSubtab: 'overview',
    workoutState: 'idle', // idle, squeezing, relaxing, completed
    selectedLevel: 'goodMorning',
    timerInterval: null,
    timeRemaining: 0,
    currentRep: 0,
    totalReps: 25,
    squeezeDuration: 1,
    relaxDuration: 2,
    isMutedSFX: false,
    isMutedBGM: true,
    history: [],
    streak: 0,
    totalSessions: 0,
    totalRepsCompleted: 0
};

// --- WORKOUT CONFIGURATIONS ---
const levelConfigs = {
    goodMorning: { squeeze: 1, relax: 2, reps: 25 },
    powerCombo: { squeeze: 1, relax: 1, reps: 63 },
    nightRecovery: { squeeze: 0, relax: 5, reps: 31 },
    beginner: { squeeze: 3, relax: 3, reps: 10 },
    intermediate: { squeeze: 5, relax: 5, reps: 12 },
    advanced: { squeeze: 10, relax: 10, reps: 10 },
    fastFlicks: { squeeze: 1, relax: 1, reps: 20 },
    ladder: { squeeze: 9, relax: 8, reps: 8 },
    mixed: { squeeze: 8, relax: 8, reps: 11 },
    pyramidMixed: { squeeze: 3, relax: 3, reps: 10 },
    reflexMixed: { squeeze: 10, relax: 5, reps: 12 }
};

function calculateSqueezes(level, reps) {
    if (level === 'goodMorning') {
        return 20; // 20 siết nhanh, 5 Kegel ngược
    }
    if (level === 'powerCombo') {
        return 54; // 20 + 12 + 12 + 10 siết cơ, còn lại là nghỉ & Kegel ngược
    }
    if (level === 'nightRecovery') {
        return 15; // 15 siết nhanh, 15 Kegel ngược, 5 hít thở
    }
    return reps;
}

// --- AUDIO CONTROLLER (Web Audio API Synthesizer) ---
class AudioController {
    constructor() {
        this.audioCtx = null;
        this.bgmSourceNode = null;
        this.bgmLfo = null;
        this.bgmGain = null;
    }

    init() {
        if (this.audioCtx) return;
        
        // Lazy-init AudioContext to satisfy browser autoplay policies
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            this.audioCtx = new AudioContextClass();
        }
    }

    resumeContext() {
        this.init();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // Play Squeeze Sound (High-pitched pure chime - C5 + G5)
    playSqueezeSFX() {
        if (state.isMutedSFX) return;
        this.resumeContext();
        if (!this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        
        // Additive synthesizers for a crystal-clear bell chime
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, now); // G5 (harmonic purity)

        gainNode.gain.setValueAtTime(0, now);
        // Fast attack
        gainNode.gain.linearRampToValueAtTime(0.55, now + 0.03);
        // Smooth decaying release
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
    }

    // Play Relax Sound (Warmer, soft low chime - G3 + E4)
    playRelaxSFX() {
        if (state.isMutedSFX) return;
        this.resumeContext();
        if (!this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(329.63, now); // E4

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(196.00, now); // G3 (Deep, relaxing base)

        gainNode.gain.setValueAtTime(0, now);
        // Softer, slower attack
        gainNode.gain.linearRampToValueAtTime(0.60, now + 0.15);
        // Long decay
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        
        osc1.stop(now + 1.5);
        osc2.stop(now + 1.5);
    }

    // Play Completion Sound (A beautiful C major arpeggio)
    playCompletionSFX() {
        if (state.isMutedSFX) return;
        this.resumeContext();
        if (!this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        
        notes.forEach((freq, index) => {
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + index * 0.12);
            
            gainNode.gain.setValueAtTime(0, now + index * 0.12);
            gainNode.gain.linearRampToValueAtTime(0.45, now + index * 0.12 + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 1.0);
            
            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            osc.start(now + index * 0.12);
            osc.stop(now + index * 0.12 + 1.0);
        });
    }

    // Synthesize Soothing Ocean/Wind Wave Soundscape for meditation
    startBGM() {
        this.resumeContext();
        if (!this.audioCtx) return;

        if (this.bgmSourceNode) return; // Already running

        const now = this.audioCtx.currentTime;

        // 1. Generate White Noise Buffer
        const sampleRate = this.audioCtx.sampleRate;
        const bufferSize = 2 * sampleRate; // 2 seconds buffer
        const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        // 2. Setup Noise Source Loop
        this.bgmSourceNode = this.audioCtx.createBufferSource();
        this.bgmSourceNode.buffer = noiseBuffer;
        this.bgmSourceNode.loop = true;

        // 3. Low Pass Filter to make white noise sound like soft wind/ocean wave
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now); // Base frequency (deep wind)
        filter.Q.setValueAtTime(1.0, now);

        // 4. LFO (Low-Frequency Oscillator) to modulate filter frequency (breathing effect)
        this.bgmLfo = this.audioCtx.createOscillator();
        this.bgmLfo.type = 'sine';
        this.bgmLfo.frequency.setValueAtTime(0.12, now); // ~8 seconds per cycle

        // LFO Gain controls how wide the filter frequency sweep is
        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.setValueAtTime(250, now); // Sweep +/- 250Hz around 400Hz

        // 5. Volume Control Node
        this.bgmGain = this.audioCtx.createGain();
        this.bgmGain.gain.setValueAtTime(0, now);
        // Fade in smoothly
        this.bgmGain.gain.linearRampToValueAtTime(0.16, now + 2.0); 

        // 6. Connect the Synthesizer Nodes
        this.bgmLfo.connect(lfoGain);
        lfoGain.connect(filter.frequency); // Modulates the cutoff frequency dynamically
        
        this.bgmSourceNode.connect(filter);
        filter.connect(this.bgmGain);
        this.bgmGain.connect(this.audioCtx.destination);

        // Start synthesizers
        this.bgmSourceNode.start(now);
        this.bgmLfo.start(now);
    }

    stopBGM() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        if (this.bgmSourceNode && this.bgmGain) {
            // Fade out smoothly before stopping to avoid audio click/pop
            this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
            this.bgmGain.gain.linearRampToValueAtTime(0, now + 1.0);
            
            const source = this.bgmSourceNode;
            const lfo = this.bgmLfo;
            
            setTimeout(() => {
                try {
                    source.stop();
                    lfo.stop();
                } catch(e) {}
            }, 1050);

            this.bgmSourceNode = null;
            this.bgmLfo = null;
            this.bgmGain = null;
        }
    }
}

const audioController = new AudioController();

// --- DOM ELEMENTS ---
const elements = {
    // Navigation Tabs
    navItems: document.querySelectorAll('.nav-item'),
    sections: document.querySelectorAll('.content-section'),
    
    // Library Tabs
    libTabBtns: document.querySelectorAll('.lib-tab-btn'),
    libPanes: document.querySelectorAll('.lib-content-pane'),

    // Workout Elements
    orb: document.getElementById('visualizer-orb'),
    orbAction: document.getElementById('orb-action'),
    orbTimer: document.getElementById('orb-timer'),
    orbSubText: document.getElementById('orb-sub-text'),
    repDisplay: document.getElementById('current-rep-display'),
    progressBar: document.getElementById('session-progress-fill'),
    btnStart: document.getElementById('btn-start'),
    btnReset: document.getElementById('btn-reset'),
    textStart: document.getElementById('text-start'),
    iconStart: document.getElementById('icon-start'),
    
    // Level Configs
    levelItems: document.querySelectorAll('.level-item'),
    customPanel: document.getElementById('custom-controls-panel'),
    customSqueezeInput: document.getElementById('custom-squeeze'),
    customRelaxInput: document.getElementById('custom-relax'),
    customRepsInput: document.getElementById('custom-reps'),

    // Sound Controls
    btnToggleSFX: document.getElementById('btn-toggle-sfx'),
    btnToggleBGM: document.getElementById('btn-toggle-bgm'),
    iconSFX: document.getElementById('icon-sfx'),
    iconBGM: document.getElementById('icon-bgm'),

    // Stats Elements
    sidebarStreak: document.getElementById('sidebar-streak'),
    sidebarTotalSessions: document.getElementById('sidebar-total-sessions'),
    statsStreak: document.getElementById('stats-streak'),
    statsTotalSessions: document.getElementById('stats-total-sessions'),
    statsTotalReps: document.getElementById('stats-total-reps'),
    historyLogBody: document.getElementById('history-log-body'),
    btnClearData: document.getElementById('btn-clear-data'),
    
    // Supabase DOM Elements
    btnCloudSync: document.getElementById('btn-cloud-sync'),
    authModal: document.getElementById('auth-modal'),
    btnCloseAuthModal: document.getElementById('btn-close-auth-modal'),
    btnSaveSupabaseConfig: document.getElementById('btn-save-supabase-config'),
    btnSubmitAuth: document.getElementById('btn-submit-auth'),
    btnAuthLogout: document.getElementById('btn-auth-logout'),
    linkToggleAuthMode: document.getElementById('link-toggle-auth-mode')
};

// --- INITIALIZE THE APP ---
function initApp() {
    loadData();
    autoSelectLevelByTime();
    setupEventHandlers();
    updateUIConfigs();
    renderStats();
    initSupabaseConnection();
}

// Automatically select default workout level based on the time of day
function autoSelectLevelByTime() {
    const hour = new Date().getHours();
    let defaultLevel = 'goodMorning';
    
    if (hour >= 5 && hour < 11) {
        defaultLevel = 'goodMorning';
    } else if (hour >= 11 && hour < 17) {
        defaultLevel = 'powerCombo';
    } else {
        defaultLevel = 'nightRecovery';
    }
    
    state.selectedLevel = defaultLevel;
    
    // Update active class in level items list
    const levelItems = document.querySelectorAll('.level-item');
    if (levelItems && levelItems.length > 0) {
        levelItems.forEach(item => {
            if (item.getAttribute('data-level') === defaultLevel) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

// --- SETUP EVENT HANDLERS ---
function setupEventHandlers() {
    // 1. Sidebar tab switching
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // 2. Library subtab switching
    elements.libTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSubtab = btn.getAttribute('data-subtab');
            switchLibrarySubtab(targetSubtab);
        });
    });

    // 3. Level selection
    elements.levelItems.forEach(item => {
        item.addEventListener('click', () => {
            if (state.workoutState !== 'idle') return; // Prevent change mid-workout
            
            elements.levelItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            state.selectedLevel = item.getAttribute('data-level');
            
            updateUIConfigs();
        });
    });

    // Custom input updates
    const customInputs = [elements.customSqueezeInput, elements.customRelaxInput, elements.customRepsInput];
    customInputs.forEach(input => {
        input.addEventListener('change', () => {
            if (state.selectedLevel === 'custom') {
                updateUIConfigs();
            }
        });
    });

    // 4. Sound toggles
    elements.btnToggleSFX.addEventListener('click', () => {
        state.isMutedSFX = !state.isMutedSFX;
        audioController.resumeContext();
        updateSoundButtons();
    });

    elements.btnToggleBGM.addEventListener('click', () => {
        state.isMutedBGM = !state.isMutedBGM;
        audioController.resumeContext();
        
        if (state.isMutedBGM) {
            audioController.stopBGM();
        } else {
            audioController.startBGM();
        }
        updateSoundButtons();
    });

    // 5. Workout controls
    elements.btnStart.addEventListener('click', () => {
        // Resume Audio context on first click interaction
        audioController.resumeContext();
        
        if (state.workoutState === 'idle') {
            startWorkout();
        } else if (state.workoutState === 'squeezing' || state.workoutState === 'relaxing') {
            pauseWorkout();
        } else if (state.workoutState.startsWith('paused_')) {
            resumeWorkout();
        }
    });

    elements.btnReset.addEventListener('click', () => {
        resetWorkout();
    });

    // 6. Stats clearing
    elements.btnClearData.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử luyện tập và chuỗi ngày tập?')) {
            clearAllData();
        }
    });

    // 7. Điều khiển gập/mở Accordion cho Lộ trình dọc (Roadmap)
    const roadmapItems = document.querySelectorAll('.roadmap-item');
    
    roadmapItems.forEach(item => {
        const header = item.querySelector('.roadmap-header');
        if (header) {
            header.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Đóng tất cả các giai đoạn khác
                roadmapItems.forEach(otherItem => {
                    otherItem.classList.remove('active');
                });
                
                // Mở giai đoạn được nhấp nếu trước đó nó chưa mở
                if (!isActive) {
                    item.classList.add('active');
                }
            });
        }
    });

    // 8. "Bắt đầu bài tập này" click handlers
    const selectWorkoutBtns = document.querySelectorAll('.btn-select-workout');
    selectWorkoutBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetLevel = btn.getAttribute('data-target-level');
            
            // Set level
            state.selectedLevel = targetLevel;
            
            // Update config cards UI active class
            elements.levelItems.forEach(item => {
                if (item.getAttribute('data-level') === targetLevel) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
            
            // Update UI Configurations
            updateUIConfigs();
            
            // Switch back to Practice tab
            switchTab('practice');
            
            // Smooth scroll to orb container
            setTimeout(() => {
                const orb = document.getElementById('visualizer-orb');
                if (orb) {
                    orb.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        });
    });

    // 9. Event delegation cho tất cả sự kiện tương tác trong Auth Modal và Cloud Sync
    document.addEventListener('click', (e) => {
        // Mở Auth Modal
        const cloudSyncBtn = e.target.closest('#btn-cloud-sync');
        if (cloudSyncBtn) {
            openAuthModal();
            return;
        }

        // Đóng Auth Modal
        const closeAuthBtn = e.target.closest('#btn-close-auth-modal');
        if (closeAuthBtn) {
            closeAuthModal();
            return;
        }

        // Chuyển đổi tab cấu hình/đăng nhập trong modal
        const authTabBtn = e.target.closest('.auth-tab-btn');
        if (authTabBtn) {
            const targetTab = authTabBtn.getAttribute('data-auth-tab');
            const siblingTabBtns = document.querySelectorAll('.auth-tab-btn');
            siblingTabBtns.forEach(b => b.classList.remove('active'));
            authTabBtn.classList.add('active');
            
            document.querySelectorAll('.auth-tab-content').forEach(content => {
                if (content.id === `auth-tab-${targetTab}`) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
            return;
        }

        // Lưu cấu hình Supabase
        const saveConfigBtn = e.target.closest('#btn-save-supabase-config');
        if (saveConfigBtn) {
            const url = document.getElementById('input-supabase-url').value.trim();
            const key = document.getElementById('input-supabase-key').value.trim();
            
            if (!url || !key) {
                alert("Vui lòng điền đầy đủ cả URL và Anon API Key.");
                return;
            }
            
            localStorage.setItem('supabase_url', url);
            localStorage.setItem('supabase_key', key);
            
            if (initSupabaseConnection()) {
                alert("Cấu hình Supabase thành công! Giờ bạn có thể đăng nhập hoặc đăng ký tài khoản.");
                const loginTabBtn = document.querySelector('.auth-tab-btn[data-auth-tab="login"]');
                if (loginTabBtn) loginTabBtn.click();
            } else {
                alert("Lưu thất bại. Vui lòng kiểm tra lại tính chính xác của URL và Key.");
            }
            return;
        }

        // Chuyển đổi Đăng Nhập / Đăng Ký
        const toggleLink = e.target.closest('#link-toggle-auth-mode');
        if (toggleLink) {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-submit-auth');
            const authTitle = document.getElementById('auth-title');
            const authDesc = document.getElementById('auth-desc');
            
            if (currentAuthMode === 'login') {
                currentAuthMode = 'register';
                if (authTitle) authTitle.textContent = 'Đăng Ký Tài Khoản';
                if (authDesc) authDesc.textContent = 'Tạo tài khoản mới để bắt đầu sao lưu tiến độ lên cơ sở dữ liệu Supabase của bạn.';
                toggleLink.textContent = 'Đã có tài khoản? Đăng nhập ngay';
                if (submitBtn) submitBtn.textContent = 'Đăng Ký';
            } else {
                currentAuthMode = 'login';
                if (authTitle) authTitle.textContent = 'Đăng Nhập Đồng Bộ';
                if (authDesc) authDesc.textContent = 'Đăng nhập tài khoản để đồng bộ hóa lịch sử luyện tập và Streak trực tuyến.';
                toggleLink.textContent = 'Chưa có tài khoản? Đăng ký ngay';
                if (submitBtn) submitBtn.textContent = 'Đăng Nhập';
            }
            return;
        }

        // Xác nhận gửi form Auth (Đăng nhập / Đăng ký)
        const submitAuthBtn = e.target.closest('#btn-submit-auth');
        if (submitAuthBtn) {
            handleAuthSubmit();
            return;
        }

        // Đăng xuất Cloud
        const logoutBtn = e.target.closest('#btn-auth-logout');
        if (logoutBtn) {
            handleLogout();
            return;
        }
    });
}

// --- TAB SWITCHING LOGIC ---
function switchTab(tabName) {
    state.currentTab = tabName;
    
    // Update menu items active state
    elements.navItems.forEach(item => {
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update section active state
    elements.sections.forEach(sec => {
        if (sec.id === `tab-${tabName}`) {
            sec.classList.add('active');
        } else {
            sec.classList.remove('active');
        }
    });
}

function switchLibrarySubtab(subtabName) {
    state.currentLibSubtab = subtabName;

    elements.libTabBtns.forEach(btn => {
        if (btn.getAttribute('data-subtab') === subtabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    elements.libPanes.forEach(pane => {
        if (pane.id === `lib-${subtabName}`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
}

// --- WORKOUT CONFIGURATION MANAGEMENT ---
function updateUIConfigs() {
    if (state.selectedLevel === 'custom') {
        elements.customPanel.style.display = 'block';
        state.squeezeDuration = Math.max(1, parseInt(elements.customSqueezeInput.value) || 5);
        state.relaxDuration = Math.max(1, parseInt(elements.customRelaxInput.value) || 5);
        state.totalReps = Math.max(1, parseInt(elements.customRepsInput.value) || 10);
    } else {
        elements.customPanel.style.display = 'none';
        const config = levelConfigs[state.selectedLevel];
        state.squeezeDuration = config.squeeze;
        state.relaxDuration = config.relax;
        state.totalReps = config.reps;
    }

    // Reset visual display elements
    elements.repDisplay.textContent = `0 / ${state.totalReps}`;
    elements.progressBar.style.width = '0%';
    elements.orbTimer.textContent = String(state.squeezeDuration).padStart(2, '0');
    elements.orbAction.textContent = 'SẴN SÀNG';
    
    if (state.selectedLevel === 'goodMorning') {
        elements.orbSubText.textContent = 'Bấm Bắt đầu để tập Chào Buổi Sáng - 25 lượt';
    } else if (state.selectedLevel === 'powerCombo') {
        elements.orbSubText.textContent = 'Bấm Bắt đầu để tập Combo Sức Mạnh - 63 lượt';
    } else if (state.selectedLevel === 'nightRecovery') {
        elements.orbSubText.textContent = 'Bấm Bắt đầu để tập Phục Hồi Ban Đêm - 31 lượt';
    } else if (state.selectedLevel === 'mixed') {
        elements.orbSubText.textContent = 'Bấm Bắt đầu để tập Cấp độ Hỗn hợp Lâm Sàng (11 lượt)';
    } else if (state.selectedLevel === 'pyramidMixed') {
        elements.orbSubText.textContent = 'Bấm Bắt đầu để tập Hỗn hợp Kim Tự Tháp (10 lượt)';
    } else if (state.selectedLevel === 'reflexMixed') {
        elements.orbSubText.textContent = 'Bấm Bắt đầu để tập Hỗn hợp Phản Xạ Sinh Lý (12 lượt)';
    } else {
        elements.orbSubText.textContent = `Bấm Bắt đầu để tập (${state.squeezeDuration}s siết - ${state.relaxDuration}s thả)`;
    }
    
    // Clear classes on orb
    elements.orb.classList.remove('squeezing', 'relaxing', 'resting', 'completed');
}

function updateSoundButtons() {
    // SFX button
    if (state.isMutedSFX) {
        elements.btnToggleSFX.classList.add('muted');
        elements.btnToggleSFX.querySelector('span').textContent = 'Tắt âm';
        elements.iconSFX.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
        `;
    } else {
        elements.btnToggleSFX.classList.remove('muted');
        elements.btnToggleSFX.querySelector('span').textContent = 'Âm báo';
        elements.iconSFX.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        `;
    }

    // BGM button
    if (state.isMutedBGM) {
        elements.btnToggleBGM.classList.add('muted');
        elements.btnToggleBGM.querySelector('span').textContent = 'Tắt nhạc';
        elements.iconBGM.innerHTML = `
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
            <line x1="3" y1="3" x2="21" y2="21"/>
        `;
    } else {
        elements.btnToggleBGM.classList.remove('muted');
        elements.btnToggleBGM.querySelector('span').textContent = 'Nhạc nền';
        elements.iconBGM.innerHTML = `
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
        `;
    }
}

// --- WORKOUT GAME LOOP / WORKFLOW ---
function startWorkout() {
    state.workoutState = 'squeezing';
    state.currentRep = 1;
    state.timeRemaining = state.squeezeDuration;
    
    // Toggle buttons state
    elements.btnReset.disabled = false;
    elements.btnStart.classList.remove('btn-primary');
    elements.btnStart.classList.add('btn-secondary');
    elements.textStart.textContent = 'Tạm dừng';
    elements.iconStart.innerHTML = `
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
    `;
    
    // Adjust levels selection access
    elements.levelItems.forEach(item => item.style.pointerEvents = 'none');
    
    // Trigger Squeeze phase
    enterSqueezePhase();
    
    // Start interval
    state.timerInterval = setInterval(tick, 1000);
}

function pauseWorkout() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    
    // Save current active state before pausing
    const oldState = state.workoutState;
    state.workoutState = 'paused_' + oldState;
    
    // Change UI state
    elements.textStart.textContent = 'Tiếp tục';
    elements.iconStart.innerHTML = `
        <polygon points="5 3 19 12 5 21 5 3"/>
    `;
    elements.orbSubText.textContent = 'Đang tạm dừng bài tập';
}

function resumeWorkout() {
    // Restore state from paused state
    const originalState = state.workoutState.replace('paused_', '');
    state.workoutState = originalState;
    
    // Change UI state
    elements.textStart.textContent = 'Tạm dừng';
    elements.iconStart.innerHTML = `
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
    `;
    
    if (state.workoutState === 'squeezing') {
        elements.orbSubText.textContent = 'Giữ cơ PC co thắt';
    } else {
        elements.orbSubText.textContent = 'Thả lỏng toàn thân, hít thở đều';
    }

    state.timerInterval = setInterval(tick, 1000);
}

// Switch pause / resume logic is now merged into main btnStart listener

function resetWorkout() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.workoutState = 'idle';
    
    // Restore Level select availability
    elements.levelItems.forEach(item => item.style.pointerEvents = 'auto');
    
    // Restore Start/Reset button
    elements.btnReset.disabled = true;
    elements.btnStart.classList.add('btn-primary');
    elements.btnStart.classList.remove('btn-secondary');
    elements.textStart.textContent = 'Bắt đầu';
    elements.iconStart.innerHTML = `
        <polygon points="5 3 19 12 5 21 5 3"/>
    `;

    updateUIConfigs();
}

// Tick core timer loop
function tick() {
    state.timeRemaining--;
    
    if (state.timeRemaining < 0) {
        // Toggle Phase Squeeze -> Relax or next rep
        if (state.workoutState === 'squeezing') {
            enterRelaxPhase();
        } else if (state.workoutState === 'relaxing') {
            if (state.currentRep >= state.totalReps) {
                finishWorkout();
            } else {
                state.currentRep++;
                enterSqueezePhase();
            }
        }
    } else {
        elements.orbTimer.textContent = String(state.timeRemaining).padStart(2, '0');
    }
}

function enterSqueezePhase() {
    state.workoutState = 'squeezing';
    
    // Dynamic duration logic for custom levels
    if (state.selectedLevel === 'goodMorning') {
        if (state.currentRep <= 20) {
            state.squeezeDuration = 1;
        } else {
            state.squeezeDuration = 5; // Reverse Kegel (Hold)
        }
    } else if (state.selectedLevel === 'powerCombo') {
        if (state.currentRep <= 20) {
            state.squeezeDuration = 1;
        } else if (state.currentRep === 21) {
            state.squeezeDuration = 0; // Skip squeeze to rest
        } else if (state.currentRep >= 22 && state.currentRep <= 33) {
            state.squeezeDuration = 3;
        } else if (state.currentRep === 34) {
            state.squeezeDuration = 0; // Skip squeeze to rest
        } else if (state.currentRep >= 35 && state.currentRep <= 46) {
            state.squeezeDuration = 3;
        } else if (state.currentRep === 47) {
            state.squeezeDuration = 0; // Skip squeeze to rest
        } else if (state.currentRep >= 48 && state.currentRep <= 57) {
            state.squeezeDuration = 5;
        } else if (state.currentRep === 58) {
            state.squeezeDuration = 0; // Skip squeeze to rest
        } else {
            state.squeezeDuration = 5; // Reverse Kegel (Hold)
        }
    } else if (state.selectedLevel === 'nightRecovery') {
        if (state.currentRep <= 15) {
            state.squeezeDuration = 1; // Fast flicks (Squeeze)
        } else if (state.currentRep === 16) {
            state.squeezeDuration = 0; // 5s Rest before Reverse Kegel
        } else if (state.currentRep <= 26) {
            state.squeezeDuration = 5; // Reverse Kegel (Hold)
        } else {
            state.squeezeDuration = 5; // Deep breathing (Inhale)
        }
    } else if (state.selectedLevel === 'mixed') {
        // Mixed logic: Reps 1-3 & 9-11 are slow (8s), Reps 4-8 are fast flicks (1s)
        if ((state.currentRep >= 1 && state.currentRep <= 3) || (state.currentRep >= 9 && state.currentRep <= 11)) {
            state.squeezeDuration = 8;
            state.relaxDuration = 8;
        } else {
            state.squeezeDuration = 1;
            state.relaxDuration = 1;
        }
    } else if (state.selectedLevel === 'ladder') {
        state.squeezeDuration = 9;
        state.relaxDuration = 8;
    } else if (state.selectedLevel === 'pyramidMixed') {
        const squeezeMap = { 1: 3, 2: 1, 3: 6, 4: 1, 5: 9, 6: 1, 7: 12, 8: 1, 9: 6, 10: 3 };
        state.squeezeDuration = squeezeMap[state.currentRep] || 3;
    } else if (state.selectedLevel === 'reflexMixed') {
        if (state.currentRep <= 4) {
            state.squeezeDuration = 10;
        } else if (state.currentRep <= 8) {
            state.squeezeDuration = 1;
        } else {
            state.squeezeDuration = 5;
        }
    }

    if (state.squeezeDuration === 0) {
        enterRelaxPhase();
        return;
    }

    state.timeRemaining = state.squeezeDuration;
    
    // UI Visual changes
    elements.orb.classList.remove('relaxing', 'squeezing', 'resting');
    
    // Identify special states
    const isReverseKegelHold = (state.selectedLevel === 'goodMorning' && state.currentRep >= 21) ||
                                (state.selectedLevel === 'powerCombo' && state.currentRep >= 59) ||
                                (state.selectedLevel === 'nightRecovery' && state.currentRep >= 17 && state.currentRep <= 26);
    const isBreathingInhale = (state.selectedLevel === 'nightRecovery' && state.currentRep >= 27);
    
    if (isReverseKegelHold) {
        elements.orb.classList.add('resting');
        elements.orbAction.textContent = 'KEGEL NGƯỢC';
        
        if (state.selectedLevel === 'goodMorning') {
            elements.orbSubText.textContent = `Hít vào - Đẩy nhẹ cơ PC ra ngoài - Lượt ${state.currentRep - 20}/5`;
        } else if (state.selectedLevel === 'powerCombo') {
            elements.orbSubText.textContent = `Hít vào - Đẩy nhẹ cơ PC ra ngoài - Lượt ${state.currentRep - 58}/5`;
        } else if (state.selectedLevel === 'nightRecovery') {
            elements.orbSubText.textContent = `Hít vào - Đẩy nhẹ cơ PC ra ngoài - Lượt ${state.currentRep - 16}/10`;
        }
    } else if (isBreathingInhale) {
        elements.orb.classList.add('relaxing');
        elements.orbAction.textContent = 'HÍT VÀO';
        elements.orbSubText.textContent = `Pha 3: Hít sâu chậm rãi bằng bụng - Lượt ${state.currentRep - 26}/5`;
    } else {
        elements.orb.classList.add('squeezing');
        elements.orbAction.textContent = 'SIẾT CƠ';
        
        if (state.selectedLevel === 'ladder') {
            elements.orbSubText.textContent = 'Siết nhẹ 30% lực';
        } else if (state.selectedLevel === 'mixed') {
            if (state.squeezeDuration === 8) {
                elements.orbSubText.textContent = 'Nhịp chậm: Siết sâu & giữ';
            } else {
                elements.orbSubText.textContent = 'Nhịp nhanh: Nhấp nhanh cơ PC';
            }
        } else if (state.selectedLevel === 'pyramidMixed') {
            if (state.squeezeDuration === 12) {
                elements.orbSubText.textContent = 'Đỉnh tháp: Siết tối đa 12 giây!';
            } else if (state.squeezeDuration === 1) {
                elements.orbSubText.textContent = 'Nhịp nhanh: Co thắt nhanh 1s';
            } else {
                elements.orbSubText.textContent = `Kim tự tháp: Siết sâu ${state.squeezeDuration}s`;
            }
        } else if (state.selectedLevel === 'reflexMixed') {
            if (state.squeezeDuration === 10) {
                elements.orbSubText.textContent = 'Sức bền: Giữ co thắt 10 giây';
            } else if (state.squeezeDuration === 1) {
                elements.orbSubText.textContent = 'Phản xạ: Nhấp nhanh liên tục 1s';
            } else {
                elements.orbSubText.textContent = 'Phục hồi: Giữ trung bình 5 giây';
            }
        } else if (state.selectedLevel === 'powerCombo') {
            if (state.currentRep <= 20) {
                elements.orbSubText.textContent = `Siết cơ PC chặt nhất có thể - Lượt ${state.currentRep}/20`;
            } else if (state.currentRep >= 22 && state.currentRep <= 33) {
                elements.orbSubText.textContent = `Pha 2: Siết giữ 3 giây - Lượt ${state.currentRep - 21}/12`;
            } else if (state.currentRep >= 35 && state.currentRep <= 46) {
                elements.orbSubText.textContent = `Pha 3: Siết giữ 3 giây - Lượt ${state.currentRep - 34}/12`;
            } else if (state.currentRep >= 48 && state.currentRep <= 57) {
                elements.orbSubText.textContent = `Pha 4: Cực hạn - Siết giữ 5 giây - Lượt ${state.currentRep - 47}/10`;
            }
        } else if (state.selectedLevel === 'nightRecovery') {
            elements.orbSubText.textContent = `Pha 1: Siết nhanh - Hít thở tự nhiên - Lượt ${state.currentRep}/15`;
        } else {
            elements.orbSubText.textContent = 'Co thắt cơ PC chặt nhất có thể';
        }
    }
    
    elements.orbTimer.textContent = String(state.timeRemaining).padStart(2, '0');
    
    updateProgressDisplays();
    audioController.playSqueezeSFX();
}

function enterRelaxPhase() {
    state.workoutState = 'relaxing';
    
    // Dynamic relax duration logic for mixed level
    if (state.selectedLevel === 'goodMorning') {
        if (state.currentRep <= 20) {
            state.relaxDuration = 2;
        } else {
            state.relaxDuration = 5; // Reverse Kegel
        }
    } else if (state.selectedLevel === 'mixed') {
        if ((state.currentRep >= 1 && state.currentRep <= 3) || (state.currentRep >= 9 && state.currentRep <= 11)) {
            state.relaxDuration = 8;
        } else {
            state.relaxDuration = 1;
        }
    } else if (state.selectedLevel === 'ladder') {
        state.relaxDuration = 8;
    } else if (state.selectedLevel === 'pyramidMixed') {
        const relaxMap = { 1: 3, 2: 1, 3: 6, 4: 1, 5: 9, 6: 1, 7: 10, 8: 1, 9: 6, 10: 3 };
        state.relaxDuration = relaxMap[state.currentRep] || 3;
    } else if (state.selectedLevel === 'reflexMixed') {
        if (state.currentRep <= 4) {
            state.relaxDuration = 5;
        } else if (state.currentRep <= 8) {
            state.relaxDuration = 1;
        } else {
            state.relaxDuration = 3;
        }
    } else if (state.selectedLevel === 'powerCombo') {
        if (state.currentRep <= 20) {
            state.relaxDuration = 1;
        } else if (state.currentRep === 21) {
            state.relaxDuration = 30;
        } else if (state.currentRep >= 22 && state.currentRep <= 33) {
            state.relaxDuration = 3;
        } else if (state.currentRep === 34) {
            state.relaxDuration = 30;
        } else if (state.currentRep >= 35 && state.currentRep <= 46) {
            state.relaxDuration = 3;
        } else if (state.currentRep === 47) {
            state.relaxDuration = 60;
        } else if (state.currentRep >= 48 && state.currentRep <= 57) {
            state.relaxDuration = 5;
        } else if (state.currentRep === 58) {
            state.relaxDuration = 10;
        } else {
            state.relaxDuration = 5; // Reverse Kegel cooldown
        }
    } else if (state.selectedLevel === 'nightRecovery') {
        if (state.currentRep <= 15) {
            state.relaxDuration = 1; // Fast flicks (Relax)
        } else if (state.currentRep === 16) {
            state.relaxDuration = 5; // 5s Rest before Reverse Kegel
        } else if (state.currentRep <= 26) {
            state.relaxDuration = 5; // Reverse Kegel
        } else {
            state.relaxDuration = 10; // Deep breathing
        }
    }

    state.timeRemaining = state.relaxDuration;
    
    // UI Visual changes
    elements.orb.classList.remove('squeezing');
    elements.orb.classList.remove('relaxing');
    elements.orb.classList.remove('resting');
    
    // Determine if it is a resting or stretching phase
    const isPureRest = (state.selectedLevel === 'powerCombo' && (state.currentRep === 21 || state.currentRep === 34 || state.currentRep === 47 || state.currentRep === 58)) ||
                       (state.selectedLevel === 'nightRecovery' && state.currentRep === 16);
    const isReverseKegelRest = (state.selectedLevel === 'goodMorning' && state.currentRep >= 21) ||
                               (state.selectedLevel === 'powerCombo' && state.currentRep >= 59) ||
                               (state.selectedLevel === 'nightRecovery' && state.currentRep >= 17 && state.currentRep <= 26);
    const isBreathingExhale = (state.selectedLevel === 'nightRecovery' && state.currentRep >= 27);
                      
    if (isPureRest) {
        elements.orb.classList.add('resting');
        elements.orbAction.textContent = (state.currentRep === 58) ? 'CHUẨN BỊ' : 'NGHỈ NGƠI';
        
        if (state.currentRep === 21) {
            elements.orbSubText.textContent = 'Nghỉ phục hồi 30s - Chuẩn bị Pha 2';
        } else if (state.currentRep === 34) {
            elements.orbSubText.textContent = 'Nghỉ phục hồi 30s - Chuẩn bị Pha 3';
        } else if (state.currentRep === 47) {
            elements.orbSubText.textContent = 'Nghỉ phục hồi 1 phút - Chuẩn bị Pha 4';
        } else if (state.currentRep === 58) {
            elements.orbSubText.textContent = 'Nghỉ phục hồi 10s - Chuẩn bị tập Kegel ngược';
        } else if (state.selectedLevel === 'nightRecovery' && state.currentRep === 16) {
            elements.orbAction.textContent = 'NGHỈ NGƠI';
            elements.orbSubText.textContent = 'Nghỉ phục hồi 5s - Chuẩn bị tập Kegel ngược';
        }
    } else if (isReverseKegelRest) {
        elements.orb.classList.add('relaxing');
        elements.orbAction.textContent = 'NGHỈ';
        
        if (state.selectedLevel === 'goodMorning') {
            elements.orbSubText.textContent = `Thở ra - Thả lỏng cơ PC tự nhiên - Lượt ${state.currentRep - 20}/5`;
        } else if (state.selectedLevel === 'powerCombo') {
            elements.orbSubText.textContent = `Thở ra - Thả lỏng cơ PC tự nhiên - Lượt ${state.currentRep - 58}/5`;
        } else if (state.selectedLevel === 'nightRecovery') {
            elements.orbSubText.textContent = `Thở ra - Thả lỏng cơ PC tự nhiên - Lượt ${state.currentRep - 16}/10`;
        }
    } else if (isBreathingExhale) {
        elements.orb.classList.add('relaxing');
        elements.orbAction.textContent = 'THỞ RA';
        elements.orbSubText.textContent = `Thở ra chậm rãi, xẹp bụng - Lượt ${state.currentRep - 26}/5`;
    } else {
        elements.orb.classList.add('relaxing');
        elements.orbAction.textContent = 'THẢ LỎNG';
        
        if (state.selectedLevel === 'mixed' && state.relaxDuration === 1) {
            elements.orbSubText.textContent = 'Thả nhanh';
        } else if (state.selectedLevel === 'pyramidMixed' && state.relaxDuration === 1) {
            elements.orbSubText.textContent = 'Thả nhanh';
        } else if (state.selectedLevel === 'reflexMixed' && state.relaxDuration === 1) {
            elements.orbSubText.textContent = 'Thả nhanh';
        } else if (state.selectedLevel === 'powerCombo') {
            if (state.currentRep <= 20) {
                elements.orbSubText.textContent = 'Thả lỏng cơ sàn chậu hoàn toàn';
            } else if (state.currentRep >= 22 && state.currentRep <= 33) {
                elements.orbSubText.textContent = 'Thả lỏng 3 giây';
            } else if (state.currentRep >= 35 && state.currentRep <= 46) {
                elements.orbSubText.textContent = 'Thả lỏng 3 giây';
            } else {
                elements.orbSubText.textContent = 'Thả lỏng hoàn toàn 5 giây';
            }
        } else if (state.selectedLevel === 'goodMorning' && state.currentRep <= 20) {
            elements.orbSubText.textContent = 'Thả lỏng 2 giây';
        } else {
            elements.orbSubText.textContent = 'Thả lỏng cơ sàn chậu hoàn toàn';
        }
    }
    
    elements.orbTimer.textContent = String(state.timeRemaining).padStart(2, '0');
    
    audioController.playRelaxSFX();
}

function updateProgressDisplays() {
    elements.repDisplay.textContent = `${state.currentRep} / ${state.totalReps}`;
    const percent = ((state.currentRep - 1) / state.totalReps) * 100;
    elements.progressBar.style.width = `${percent}%`;
}

function finishWorkout() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.workoutState = 'completed';
    
    // Visual indicators
    elements.orb.classList.remove('squeezing', 'relaxing');
    elements.orb.classList.add('completed');
    elements.orbAction.textContent = 'HOÀN THÀNH';
    elements.orbTimer.textContent = '✓';
    elements.orbSubText.textContent = 'Tuyệt vời! Bạn đã hoàn thành hiệp tập.';
    
    // Progress bar full
    elements.progressBar.style.width = '100%';
    elements.repDisplay.textContent = `${state.totalReps} / ${state.totalReps}`;
    
    // Update controllers
    elements.btnStart.disabled = true;
    audioController.playCompletionSFX();

    // Save statistics & log
    saveWorkoutLog();
}

// --- DATA PERSISTENCE & STATISTICS ---
function saveWorkoutLog() {
    const logEntry = {
        id: 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        level: state.selectedLevel,
        config: {
            squeeze: state.squeezeDuration,
            relax: state.relaxDuration,
            reps: state.totalReps
        },
        completed: true
    };
    
    state.history.unshift(logEntry); // Add to the front
    
    // Calculate Streak & Totals
    state.totalSessions += 1;
    state.totalRepsCompleted += calculateSqueezes(state.selectedLevel, state.totalReps);
    
    calculateStreak();
    saveData();
    renderStats();
    uploadNewLogOnline(logEntry);
}

function calculateStreak() {
    if (state.history.length === 0) {
        state.streak = 0;
        return;
    }

    const todayStr = new Date().toDateString();
    let currentStreak = 0;
    let checkDate = new Date();
    
    // Deduplicate history dates to daily exercises
    const exerciseDates = new Set();
    state.history.forEach(log => {
        const d = new Date(log.timestamp).toDateString();
        exerciseDates.add(d);
    });
    
    // Check if the user worked out today
    let hasTrainedToday = exerciseDates.has(todayStr);
    
    if (hasTrainedToday) {
        currentStreak = 1;
        checkDate.setDate(checkDate.getDate() - 1); // Move to yesterday
    } else {
        // Check if worked out yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (exerciseDates.has(yesterday.toDateString())) {
            currentStreak = 1;
            checkDate = yesterday;
            checkDate.setDate(checkDate.getDate() - 1); // Move day before yesterday
        } else {
            // Broken streak
            state.streak = 0;
            return;
        }
    }
    
    // Work backward
    while (true) {
        const targetDateStr = checkDate.toDateString();
        if (exerciseDates.has(targetDateStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    state.streak = currentStreak;
}

function saveData() {
    localStorage.setItem('pc_flex_history', JSON.stringify(state.history));
    localStorage.setItem('pc_flex_streak', state.streak);
    localStorage.setItem('pc_flex_total_sessions', state.totalSessions);
    localStorage.setItem('pc_flex_total_reps', state.totalRepsCompleted);
}

function loadData() {
    try {
        state.history = JSON.parse(localStorage.getItem('pc_flex_history')) || [];
        state.streak = parseInt(localStorage.getItem('pc_flex_streak')) || 0;
        state.totalSessions = parseInt(localStorage.getItem('pc_flex_total_sessions')) || 0;
        state.totalRepsCompleted = state.history.reduce((sum, log) => {
            const level = log.level;
            const reps = log.config ? (log.config.reps || 0) : (log.reps || 0);
            return sum + calculateSqueezes(level, reps);
        }, 0);
        
        // Recalculate streak on load to ensure it resets if a day was missed
        calculateStreak();
    } catch(e) {
        console.error("Lỗi khi tải dữ liệu từ localStorage", e);
    }
}

// --- HELPER FUNCTIONS FOR STATS TAB ---
function updateBadges() {
    const badges = {
        'badge-first-workout': state.totalSessions >= 1,
        'badge-streak-3': state.streak >= 3,
        'badge-streak-7': state.streak >= 7,
        'badge-sessions-10': state.totalSessions >= 10,
        'badge-sessions-30': state.totalSessions >= 30,
        'badge-level-8': state.history.some(log => log.level === 'reflexMixed')
    };
    
    for (const [badgeId, isUnlocked] of Object.entries(badges)) {
        const el = document.getElementById(badgeId);
        if (el) {
            if (isUnlocked) {
                el.classList.remove('locked');
            } else {
                el.classList.add('locked');
            }
        }
    }
}

function renderWeeklyCalendar() {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
    
    const dayCards = document.querySelectorAll('.calendar-day');
    dayCards.forEach(card => {
        const dayVal = parseInt(card.getAttribute('data-day'));
        
        // Đánh dấu ngày hôm nay bằng viền/hiệu ứng pulse
        if (dayVal === currentDayOfWeek) {
            card.classList.add('today');
        } else {
            card.classList.remove('today');
        }
        
        // Reset trạng thái hoàn thành
        card.classList.remove('completed');
        const statusEl = card.querySelector('.day-status');
        if (statusEl) {
            statusEl.textContent = '';
        }
    });
    
    // Tìm ngày Thứ 2 đầu tuần và Chủ Nhật cuối tuần hiện tại
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1); // Trừ lùi về thứ 2
    
    const monday = new Date(now.setDate(diffToMonday));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    // Tìm các thứ trong tuần hiện tại có lịch sử tập
    const completedDays = new Set();
    state.history.forEach(log => {
        const logDate = new Date(log.timestamp);
        if (logDate >= monday && logDate <= sunday) {
            completedDays.add(logDate.getDay());
        }
    });
    
    // Cập nhật giao diện dấu tích ✓ cho các thứ đã tập
    dayCards.forEach(card => {
        const dayVal = parseInt(card.getAttribute('data-day'));
        if (completedDays.has(dayVal)) {
            card.classList.add('completed');
            const statusEl = card.querySelector('.day-status');
            if (statusEl) {
                statusEl.textContent = '✓';
            }
        }
    });
}

function renderStats() {
    // 1. Sidebar Stats
    elements.sidebarStreak.innerHTML = `<span class="emoji">🔥</span> ${state.streak} ngày`;
    elements.sidebarTotalSessions.textContent = `${state.totalSessions} hiệp`;

    // 2. Stats Dashboard Tab
    if (elements.statsStreak) {
        elements.statsStreak.textContent = `${state.streak} ngày`;
        elements.statsTotalSessions.textContent = `${state.totalSessions} hiệp`;
        elements.statsTotalReps.textContent = `${state.totalRepsCompleted} lượt`;
    }

    // 3. Home Page Stats Badge
    const homeRepsCount = document.getElementById('home-total-reps-count');
    if (homeRepsCount) {
        homeRepsCount.textContent = state.totalRepsCompleted;
    }

    // Cập nhật Lịch hoạt động và Huy hiệu
    renderWeeklyCalendar();
    updateBadges();

    // 3. Render History Table Log
    if (elements.historyLogBody) {
        if (state.history.length === 0) {
            elements.historyLogBody.innerHTML = `
                <tr>
                    <td colspan="4" class="no-data">
                        <div class="empty-history-visual" style="padding: 2.5rem 1rem; text-align: center;">
                            <div class="empty-icon" style="font-size: 2.8rem; margin-bottom: 0.75rem;">📊</div>
                            <h4 style="color: var(--color-text-primary); margin-bottom: 0.5rem; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.2px;">Chưa Có Nhật Ký Luyện Tập</h4>
                            <p style="color: var(--color-text-secondary); max-width: 440px; margin: 0 auto 1.5rem auto; font-size: 0.85rem; line-height: 1.6; font-family: var(--font-secondary);">
                                Trang "Tiến độ" này tự động ghi nhận chuỗi ngày tập liên tục (Streak), tổng số hiệp đã tập hoàn chỉnh và lịch hoạt động tuần. Hãy chọn một cấp độ ở tab <strong>Luyện tập</strong> và thực hiện trọn vẹn đến khi kết thúc hiệp, dữ liệu của bạn sẽ ngay lập tức được lưu trữ và hiển thị tại đây.
                            </p>
                            <button class="btn btn-primary btn-sm btn-go-practice" style="max-width: 200px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0, 245, 212, 0.25);">Bắt đầu hiệp tập ngay</button>
                        </div>
                    </td>
                </tr>
            `;
            setTimeout(() => {
                const btn = document.querySelector('.btn-go-practice');
                if (btn) {
                    btn.addEventListener('click', () => {
                        switchTab('practice');
                    });
                }
            }, 50);
            return;
        }

        elements.historyLogBody.innerHTML = state.history.slice(0, 10).map(log => {
            const date = new Date(log.timestamp);
            const timeStr = `${date.toLocaleDateString('vi-VN')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            
            let levelLabel = '';
            switch(log.level) {
                case 'beginner': levelLabel = 'Sơ cấp (C1)'; break;
                case 'intermediate': levelLabel = 'Trung cấp (C2)'; break;
                case 'advanced': levelLabel = 'Nâng cao (C3)'; break;
                case 'fastFlicks': levelLabel = 'Nhấp nhanh (C4)'; break;
                case 'ladder': levelLabel = 'Nấc thang (C5)'; break;
                case 'mixed': levelLabel = 'Hỗn hợp (C6)'; break;
                case 'pyramidMixed': levelLabel = 'Hỗn hợp (C7)'; break;
                case 'reflexMixed': levelLabel = 'Hỗn hợp (C8)'; break;
                default: levelLabel = 'Tự do';
            }

            return `
                <tr>
                    <td>${timeStr}</td>
                    <td><span class="badge badge-level">${levelLabel}</span></td>
                    <td>Siết: ${log.config.squeeze}s | Thả: ${log.config.relax}s | Lượt: ${log.config.reps}</td>
                    <td><span class="badge badge-success">Hoàn thành</span></td>
                </tr>
            `;
        }).join('');
    }
}

function clearAllData() {
    localStorage.clear();
    state.history = [];
    state.streak = 0;
    state.totalSessions = 0;
    state.totalRepsCompleted = 0;
    
    renderStats();
    updateUIConfigs();
}

// --- SUPABASE CLOUD MANAGEMENT ---
let supabaseClient = null;
let currentAuthMode = 'login';

function initSupabaseConnection() {
    // Tích hợp sẵn thông tin kết nối mặc định của bạn
    const defaultUrl = 'https://rwmhivfwjusezxedjtgw.supabase.co';
    const defaultKey = 'sb_publishable_sOm6SWd3dIIerce97LHXNw_OVCroPTr';
    
    let url = localStorage.getItem('supabase_url');
    let key = localStorage.getItem('supabase_key');
    
    // Nếu chưa có cấu hình trong LocalStorage, tự động thiết lập cấu hình mặc định
    if (!url || !key) {
        url = defaultUrl;
        key = defaultKey;
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', key);
    }
    
    const warningEl = document.getElementById('auth-connection-warning');
    const emailInput = document.getElementById('input-auth-email');
    const passwordInput = document.getElementById('input-auth-password');
    const submitBtn = document.getElementById('btn-submit-auth');
    const toggleLink = document.getElementById('link-toggle-auth-mode');
    
    if (url && key) {
        try {
            if (window.supabase) {
                // Đảm bảo URL kết nối được làm sạch (bỏ đuôi /rest/v1/ nếu có)
                const cleanUrl = url.replace(/\/rest\/v1\/?$/, '');
                supabaseClient = window.supabase.createClient(cleanUrl, key);
                
                // Mở khóa form đăng nhập
                if (warningEl) warningEl.style.display = 'none';
                if (emailInput) emailInput.disabled = false;
                if (passwordInput) passwordInput.disabled = false;
                if (submitBtn) submitBtn.disabled = false;
                if (toggleLink) {
                    toggleLink.style.cursor = 'pointer';
                    toggleLink.style.opacity = '1';
                }
                
                // Gán giá trị vào input config để hiển thị
                const configUrl = document.getElementById('input-supabase-url');
                const configKey = document.getElementById('input-supabase-key');
                if (configUrl) configUrl.value = url;
                if (configKey) configKey.value = key;
                
                checkUserSession();
                return true;
            }
        } catch (e) {
            console.error("Lỗi khởi tạo Supabase:", e);
        }
    }
    
    // Nếu chưa cấu hình, khóa form Auth
    supabaseClient = null;
    if (warningEl) warningEl.style.display = 'block';
    if (emailInput) emailInput.disabled = true;
    if (passwordInput) passwordInput.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (toggleLink) {
        toggleLink.style.cursor = 'not-allowed';
        toggleLink.style.opacity = '0.5';
    }
    return false;
}

async function checkUserSession() {
    if (!supabaseClient) return;
    
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        
        updateAuthUI(session ? session.user : null);
        if (session) {
            syncDataOnline();
        }
    } catch (e) {
        console.error("Lỗi kiểm tra session:", e);
    }
}

function updateAuthUI(user) {
    const fieldsDiv = document.getElementById('auth-form-fields');
    const profileDiv = document.getElementById('user-profile-section');
    const profileEmail = document.getElementById('user-profile-email');
    
    if (user) {
        if (fieldsDiv) fieldsDiv.style.display = 'none';
        if (profileDiv) profileDiv.style.display = 'block';
        if (profileEmail) profileEmail.textContent = user.email;
        updateSyncStatusUI('online');
    } else {
        if (fieldsDiv) fieldsDiv.style.display = 'block';
        if (profileDiv) profileDiv.style.display = 'none';
        updateSyncStatusUI('offline');
    }
}

function updateSyncStatusUI(status) {
    const cloudBtn = document.getElementById('btn-cloud-sync');
    const cloudBtnText = document.getElementById('cloud-sync-status-text');
    const homeSyncDot = document.getElementById('home-sync-dot');
    const homeSyncText = document.getElementById('home-sync-text');
    const homeSyncStatus = document.getElementById('home-sync-status');
    
    if (homeSyncDot) {
        homeSyncDot.style.animation = 'none';
    }
    
    if (status === 'offline') {
        if (cloudBtnText) cloudBtnText.textContent = 'Đồng bộ Cloud';
        if (cloudBtn) {
            cloudBtn.classList.remove('online', 'syncing');
        }
        if (homeSyncDot) homeSyncDot.style.backgroundColor = '#9ca3af';
        if (homeSyncText) homeSyncText.textContent = 'Chưa kết nối Cloud';
        if (homeSyncStatus) {
            homeSyncStatus.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            homeSyncStatus.style.background = 'rgba(255, 255, 255, 0.03)';
        }
    } else if (status === 'syncing') {
        if (cloudBtnText) cloudBtnText.textContent = 'Đang đồng bộ...';
        if (cloudBtn) {
            cloudBtn.classList.remove('online');
            cloudBtn.classList.add('syncing');
        }
        if (homeSyncDot) {
            homeSyncDot.style.backgroundColor = '#f59e0b';
            homeSyncDot.style.animation = 'pulse-dot 1.2s infinite alternate';
        }
        if (homeSyncText) homeSyncText.textContent = 'Đang đồng bộ...';
        if (homeSyncStatus) {
            homeSyncStatus.style.borderColor = 'rgba(245, 158, 11, 0.2)';
            homeSyncStatus.style.background = 'rgba(245, 158, 11, 0.04)';
        }
    } else if (status === 'online') {
        if (cloudBtnText) cloudBtnText.textContent = 'Đã đồng bộ';
        if (cloudBtn) {
            cloudBtn.classList.remove('syncing');
            cloudBtn.classList.add('online');
        }
        if (homeSyncDot) homeSyncDot.style.backgroundColor = '#10b981';
        if (homeSyncText) homeSyncText.textContent = 'Đã đồng bộ Cloud';
        if (homeSyncStatus) {
            homeSyncStatus.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            homeSyncStatus.style.background = 'rgba(16, 185, 129, 0.04)';
        }
    } else if (status === 'error') {
        if (cloudBtnText) cloudBtnText.textContent = 'Lỗi đồng bộ';
        if (cloudBtn) {
            cloudBtn.classList.remove('syncing');
        }
        if (homeSyncDot) homeSyncDot.style.backgroundColor = '#ef4444';
        if (homeSyncText) homeSyncText.textContent = 'Lỗi đồng bộ';
        if (homeSyncStatus) {
            homeSyncStatus.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            homeSyncStatus.style.background = 'rgba(239, 68, 68, 0.04)';
        }
    }
}

async function handleAuthSubmit() {
    if (!supabaseClient) return;
    
    const email = document.getElementById('input-auth-email').value.trim();
    const password = document.getElementById('input-auth-password').value;
    const submitBtn = document.getElementById('btn-submit-auth');
    
    if (!email || !password) {
        alert("Vui lòng điền đầy đủ Email và Mật khẩu.");
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = currentAuthMode === 'login' ? 'Đang đăng nhập...' : 'Đang đăng ký...';
    
    try {
        if (currentAuthMode === 'login') {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            if (error) throw error;
            updateAuthUI(data.user);
            await syncDataOnline();
            alert("Đăng nhập và đồng bộ dữ liệu đám mây thành công!");
            closeAuthModal();
        } else {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });
            if (error) throw error;
            
            if (data.user && data.session) {
                updateAuthUI(data.user);
                await syncDataOnline();
                alert("Đăng ký tài khoản và tự động đồng bộ đám mây thành công!");
                closeAuthModal();
            } else {
                alert("Đăng ký thành công! Vui lòng kiểm tra Email của bạn để nhấp vào link kích hoạt tài khoản.");
                closeAuthModal();
            }
        }
    } catch (e) {
        alert("Lỗi xác thực: " + e.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = currentAuthMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký';
    }
}

async function handleLogout() {
    if (!supabaseClient) return;
    
    if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi tài khoản đám mây? Lịch sử trên máy vẫn sẽ được bảo lưu.")) {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            
            updateAuthUI(null);
            alert("Đã đăng xuất tài khoản đám mây thành công!");
        } catch (e) {
            alert("Lỗi đăng xuất: " + e.message);
        }
    }
}

async function syncDataOnline() {
    if (!supabaseClient) return;
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        
        updateSyncStatusUI('syncing');
        
        // 1. Tải log online từ Supabase
        const { data: onlineLogs, error } = await supabaseClient
            .from('pc_flex_logs')
            .select('*')
            .order('timestamp', { ascending: false });
            
        if (error) throw error;
        
        // 2. Lấy dữ liệu local offline hiện tại
        const localHistory = JSON.parse(localStorage.getItem('pc_flex_history')) || [];
        
        const timestamps = new Set();
        const merged = [];
        
        const getNormTime = (t) => new Date(t).getTime();
        
        // Đưa dữ liệu online vào merged
        onlineLogs.forEach(log => {
            const time = getNormTime(log.timestamp);
            const roundTime = Math.round(time / 1000) * 1000; // Làm tròn giây
            timestamps.add(roundTime);
            
            merged.push({
                id: log.id,
                timestamp: log.timestamp,
                level: log.level,
                config: {
                    squeeze: log.squeeze,
                    relax: log.relax,
                    reps: log.reps
                },
                completed: log.completed
            });
        });
        
        // Tìm các bản ghi offline chưa được upload lên online
        const toUpload = [];
        localHistory.forEach(log => {
            const time = getNormTime(log.timestamp);
            const roundTime = Math.round(time / 1000) * 1000;
            
            if (!timestamps.has(roundTime)) {
                timestamps.add(roundTime);
                merged.push(log);
                
                toUpload.push({
                    user_id: user.id,
                    timestamp: log.timestamp,
                    level: log.level,
                    squeeze: log.config.squeeze,
                    relax: log.config.relax,
                    reps: log.config.reps,
                    completed: log.completed
                });
            }
        });
        
        // 3. Tải lên dữ liệu offline mới
        if (toUpload.length > 0) {
            const { error: uploadError } = await supabaseClient
                .from('pc_flex_logs')
                .insert(toUpload);
                
            if (uploadError) throw uploadError;
            console.log(`Đã tải lên ${toUpload.length} bản ghi offline lên Supabase.`);
        }
        
        // Sắp xếp giảm dần theo thời gian
        merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // 4. Lưu lại local
        state.history = merged;
        state.totalSessions = state.history.length;
        state.totalRepsCompleted = state.history.reduce((sum, log) => {
            const lvl = log.level;
            const rps = log.config ? (log.config.reps || 0) : (log.reps || 0);
            return sum + calculateSqueezes(lvl, rps);
        }, 0);
        calculateStreak();
        saveData();
        renderStats();
        
        updateSyncStatusUI('online');
    } catch (e) {
        console.error("Lỗi đồng bộ online:", e);
        updateSyncStatusUI('error');
    }
}

async function uploadNewLogOnline(logEntry) {
    if (!supabaseClient) return;
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        
        updateSyncStatusUI('syncing');
        
        const { error } = await supabaseClient
            .from('pc_flex_logs')
            .insert({
                user_id: user.id,
                timestamp: logEntry.timestamp,
                level: logEntry.level,
                squeeze: logEntry.config.squeeze,
                relax: logEntry.config.relax,
                reps: logEntry.config.reps,
                completed: logEntry.completed
            });
            
        if (error) throw error;
        console.log("Tự động lưu bài tập mới lên Supabase Cloud thành công.");
        
        updateSyncStatusUI('online');
        
        // Cập nhật lại giao diện lịch tuần
        renderWeeklyCalendar();
    } catch (e) {
        console.error("Lỗi lưu trực tuyến:", e);
        updateSyncStatusUI('error');
    }
}

function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
}

// --- START APP ON DOCUMENT LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});
