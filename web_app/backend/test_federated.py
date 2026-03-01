import requests
import json
import time
import random

PUSH_URL = "http://localhost:5000/api/federated/push"
PULL_URL = "http://localhost:5000/api/federated/pull"

def fetch_global_model():
    print("\n--- Pulling Global Model ---")
    resp = requests.get(PULL_URL)
    if resp.status_code == 200:
        data = resp.json()
        print(f"Global Model Version: {data.get('version')}")
        print(f"Global Weights: {data.get('weights')}")
    else:
        print(f"Pull Failed: {resp.status_code}")

def simulate_client(client_id, base_weights):
    print(f"\n--- Simulating Client: {client_id} ---")
    # Drift the weights
    drifted_weights = [w + (random.random() - 0.5) * 0.1 for w in base_weights]
    
    payload = {
        "client_id": client_id,
        "weights": drifted_weights
    }
    
    resp = requests.post(PUSH_URL, json=payload)
    if resp.status_code == 200:
        print(f"Pushed Local Weights for {client_id}")
    else:
        print(f"Push Failed: {resp.status_code}")

if __name__ == "__main__":
    fetch_global_model()
    
    base_weights = [0.1, 0.2, 0.3, -0.1, -0.2]
    
    print("\n[!] Triggering 3 clients to hit the Aggregation Threshold...")
    simulate_client("synth-client-1", base_weights)
    time.sleep(1)
    simulate_client("synth-client-2", base_weights)
    time.sleep(1)
    simulate_client("synth-client-3", base_weights)
    
    time.sleep(2)  # Give backend time to aggregate and commit
    
    fetch_global_model()
