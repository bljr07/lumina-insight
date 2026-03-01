const { createApp, ref, onMounted, computed, onUnmounted } = Vue;

const API_BASE = 'http://localhost:5000/api';

const App = {
    setup() {
        // ---- Reactive State ----
        const currentState = ref('PENDING_LOCAL_AI');
        const ghostData = ref([]);
        const skillData = ref([]);
        const isLoading = ref(true);
        const error = ref(null);

        // ---- Computed Properties for UI styling ----
        const stateColorClass = computed(() => {
            switch (currentState.value) {
                case 'FOCUSED': return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_15px_rgba(52,211,153,0.3)] animate-pulse-glow';
                case 'DEEP_READING': return 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10 shadow-[0_0_15px_rgba(129,140,248,0.3)] animate-pulse-glow';
                case 'STRUGGLING': return 'text-rose-400 border-rose-400/30 bg-rose-400/10 shadow-[0_0_15px_rgba(251,113,133,0.3)] animate-pulse-glow';
                case 'STALLED': return 'text-amber-400 border-amber-400/30 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.3)] animate-pulse-glow';
                case 'RE_READING': return 'text-sky-400 border-sky-400/30 bg-sky-400/10 shadow-[0_0_15px_rgba(56,189,248,0.3)] animate-pulse-glow';
                default: return 'text-slate-400 border-slate-600 bg-slate-800/50';
            }
        });

        const stateLabel = computed(() => {
            if (currentState.value === 'PENDING_LOCAL_AI') return 'Analyzing Behavior...';
            return currentState.value.replace('_', ' ');
        });

        // ---- Methods ----

        /**
         * Fetch initial state from Service Worker and set up listeners for real-time changes
         */
        const initExtensionState = () => {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                // Fetch current status
                chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[Vue] SW Error:', chrome.runtime.lastError);
                        return;
                    }
                    if (response && response.lastState) {
                        currentState.value = response.lastState;
                    }
                });

                // Listen for live updates
                const messageListener = (message) => {
                    if (message.type === 'STATE_UPDATED') {
                        currentState.value = message.payload;
                    }
                };
                chrome.runtime.onMessage.addListener(messageListener);

                // Cleanup listener when unmounted
                onUnmounted(() => {
                    chrome.runtime.onMessage.removeListener(messageListener);
                });
            } else {
                console.warn('[Vue] Not running in extension context.');
            }
        };

        /**
         * Fetch analytics from the Flask backend
         */
        const fetchDashboardData = async () => {
            try {
                // Fetch Ghost Data (Self Comparison)
                const ghostRes = await fetch(`${API_BASE}/ghost-mode`);
                if (ghostRes.ok) {
                    const data = await ghostRes.json();
                    ghostData.value = data.ghostData || [];
                }

                // Fetch skills radar
                const skillRes = await fetch(`${API_BASE}/skill-radar`);
                if (skillRes.ok) {
                    skillData.value = await skillRes.json();
                    renderRadarChart();
                }

            } catch (err) {
                console.error('[Vue] Fetch Error:', err);
                error.value = "Unable to connect to Lumina Backend.";
            } finally {
                isLoading.value = false;
            }
        };

        let radarChartInstance = null;
        const renderRadarChart = () => {
            const ctx = document.getElementById('skillRadarCanvas');
            if (!ctx || skillData.value.length === 0) return;

            if (radarChartInstance) radarChartInstance.destroy();

            const labels = skillData.value.map(s => s.skill);
            const data = skillData.value.map(s => s.value);

            radarChartInstance = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Mastery Profile',
                        data: data,
                        backgroundColor: 'rgba(20, 184, 166, 0.2)', // brand teal
                        borderColor: 'rgba(20, 184, 166, 1)',
                        pointBackgroundColor: 'rgba(20, 184, 166, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(20, 184, 166, 1)',
                        borderWidth: 2,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        r: {
                            angleLines: { color: 'rgba(255,255,255,0.1)' },
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            pointLabels: { color: '#94a3b8', font: { size: 11 } },
                            ticks: { display: false }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        };

        // ---- Lifecycle Hook ----
        onMounted(() => {
            initExtensionState();
            fetchDashboardData();
        });

        return {
            currentState,
            stateColorClass,
            stateLabel,
            ghostData,
            isLoading,
            error
        };
    },

    template: `
        <div class="space-y-6 pb-6">
            
            <!-- Header -->
            <div class="flex items-center justify-between">
                <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <span class="text-brand-500">◆</span> Lumina Insight
                </h1>
                <div class="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div>
            </div>

            <!-- Error Banner -->
            <div v-if="error" class="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm">
                {{ error }}
            </div>

            <!-- Real-Time AI Status -->
            <div class="glass-panel p-5 text-center flex flex-col items-center justify-center space-y-2">
                <span class="text-xs font-semibold uppercase tracking-wider text-ui-muted mb-1">Current Learning State</span>
                <div :class="['px-6 py-2 rounded-full border border-solid text-sm font-bold tracking-widest uppercase transition-all duration-500', stateColorClass]">
                    {{ stateLabel }}
                </div>
            </div>

            <!-- Ghost Mode (Self-Comparison) -->
            <div class="glass-panel p-5">
                <h2 class="text-sm font-semibold uppercase tracking-wider text-ui-muted mb-4 border-b border-white/5 pb-2">Ghost Mode (Self-Comparison)</h2>
                
                <div v-if="isLoading" class="text-center py-4 text-ui-muted text-sm animate-pulse">
                    Generating mirrors...
                </div>

                <div v-else class="space-y-4">
                    <div v-for="(item, index) in ghostData" :key="index" class="flex items-center justify-between group">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded bg-slate-700/50 flex items-center justify-center text-xs text-white shadow-inner">
                                {{ item.current }}
                            </div>
                            <div class="text-sm text-slate-300 group-hover:text-white transition-colors">
                                {{ item.label }}
                            </div>
                        </div>
                        
                        <!-- Change Indicator -->
                        <div class="flex items-center gap-2 text-xs">
                            <span class="text-ui-muted line-through">{{ item.past }}</span>
                            <span :class="item.improving ? 'text-emerald-400' : 'text-rose-400'">
                                {{ item.improving ? '▲' : '▼' }} {{ Math.abs(item.change) }}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Skill Radar Canvas -->
            <div class="glass-panel p-5">
                <h2 class="text-sm font-semibold uppercase tracking-wider text-ui-muted mb-4 border-b border-white/5 pb-2">Cognitive Map</h2>
                <div class="relative w-full aspect-square">
                    <canvas id="skillRadarCanvas"></canvas>
                </div>
            </div>

            <div class="text-xs text-center text-ui-muted mt-8">
                Data strictly private. Processed on-device.
            </div>

        </div>
    `
};

// Mount the App
createApp(App).mount('#app');
