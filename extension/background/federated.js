/**
 * Lumina Insight — Federated Learning Module (Phase 5 MVP)
 * 
 * Handles pulling the global model from the backend, simulating local training
 * on the current edge-device behavioral metrics, and securely pushing the 
 * mathematical weight adjustments back to the cloud.
 */

// ─── Configuration ────────────────────────────────────────────────────────

const FEDERATED_PULL_URL = 'http://localhost:5000/api/federated/pull';
const FEDERATED_PUSH_URL = 'http://localhost:5000/api/federated/push';
const SYNC_INTERVAL_MS = 30000; // 30 seconds for MVP testing

// ─── State ────────────────────────────────────────────────────────────────

let _globalModelVersion = 0;
let _currentWeights = [];
let _clientId = null;

// ─── Utilities ────────────────────────────────────────────────────────────

/**
 * Generates an anonymous UUID for tracking client contributions over the session.
 */
function getClientId() {
    if (!_clientId) {
        _clientId = 'client-' + Math.random().toString(36).substring(2, 15);
    }
    return _clientId;
}

/**
 * Simulates local weight extraction.
 * In production, this runs ONNX backpropagation over `latestPacket`.
 * Here, we drift the current model weights slightly based on recent behavior.
 */
function extractLocalWeights(baseWeights, lastState) {
    if (!baseWeights || baseWeights.length === 0) return [0.1, 0.2, -0.1, 0.05, -0.05];

    // Mock: Apply minor random drifts (+/- 0.05) to represent local training
    return baseWeights.map(w => {
        let adjustment = (Math.random() - 0.5) * 0.1;
        // Boost learning signal if struggling
        if (lastState === 'STRUGGLING') adjustment += 0.05;
        return w + adjustment;
    });
}

// ─── Core Logic ───────────────────────────────────────────────────────────

/**
 * Pulls the latest aggregated model from the Global Knowledge Graph.
 */
async function pullGlobalModel() {
    try {
        const response = await fetch(FEDERATED_PULL_URL);
        if (response.ok) {
            const data = await response.json();
            if (data.version > _globalModelVersion) {
                _globalModelVersion = data.version;
                _currentWeights = data.weights;
                console.debug(`[Federated] Successfully Pulled Global Model v${_globalModelVersion}`);
            }
        }
    } catch (err) {
        console.warn('[Federated] Failed to pull global model:', err.message);
    }
}

/**
 * Pushes locally computed weights to the aggregation server.
 */
async function pushLocalWeights(weights) {
    try {
        const payload = {
            client_id: getClientId(),
            weights: weights
        };

        const response = await fetch(FEDERATED_PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.debug('[Federated] Successfully Pushed Local Weights');
        }
    } catch (err) {
        console.warn('[Federated] Failed to push local weights:', err.message);
    }
}

/**
 * Implements the full sync loop:
 * 1. Pulls the latest global model.
 * 2. Extracts simulated local weights based on recent behavior.
 * 3. Pushes the weights back to the federation.
 * 
 * @param {string} lastState - The current learning state of the student.
 */
async function runFederatedSync(lastState) {
    await pullGlobalModel();

    if (_currentWeights && _currentWeights.length > 0) {
        // Train locally on the device
        const localWeights = extractLocalWeights(_currentWeights, lastState);

        // Sync to cloud
        await pushLocalWeights(localWeights);
    } else {
        // Bootstrap if no global model exists
        await pullGlobalModel();
    }
}

// ─── Initialization ───────────────────────────────────────────────────────

let _syncTimer = null;

/**
 * Starts the periodic federated learning sync loop.
 * @param {Function} getStateContext - A callback returning the current simulated state.
 */
function startFederatedLoop(getStateContext) {
    if (_syncTimer) clearInterval(_syncTimer);

    _syncTimer = setInterval(async () => {
        // Get state context from service worker
        const { session } = await getStateContext();
        const lastState = session?.lastState || 'UNKNOWN';

        await runFederatedSync(lastState);
    }, SYNC_INTERVAL_MS);

    console.debug('[Federated] Loop Initialized (Interval:', SYNC_INTERVAL_MS, 'ms)');

    // Do an immediate pull to bootstrap
    pullGlobalModel().then(() => {
        if (_currentWeights.length === 0) {
            _currentWeights = [0.1, 0.2, 0.3, -0.1, -0.2]; // seed
        }
    });
}

export { startFederatedLoop };
